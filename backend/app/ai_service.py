
import asyncio
import json
import logging
import os

from dotenv import load_dotenv
from google import genai
from google.genai import types
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import SessionLocal
from app.models import AIUsageLog, Conversation
from app.schemas import AIResponse
from app.ticket_service import create_ticket


# --------------------------------------------------
# Configuration
# --------------------------------------------------

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise RuntimeError(
        "GEMINI_API_KEY is missing. Check your backend .env file."
    )

REQUEST_TIMEOUT_MS = 30_000

client = genai.Client(
    api_key=api_key,
    http_options=types.HttpOptions(
        timeout=REQUEST_TIMEOUT_MS,
    ),
)

MODEL = "gemini-3.5-flash-lite"
GENERAL_MODEL = MODEL


TICKET_TOOL = {
    "type": "function",
    "name": "create_support_ticket",
    "description": (
        "Create a support ticket when a customer explicitly requests "
        "human assistance or has an unresolved issue requiring follow-up. "
        "Do not create tickets for ordinary questions."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "subject": {
                "type": "string",
                "description": "A short title for the customer's issue.",
            },
            "description": {
                "type": "string",
                "description": "A clear summary of the customer's issue.",
            },
        },
        "required": ["subject", "description"],
    },
}


# --------------------------------------------------
# Usage metadata helpers
# --------------------------------------------------

def _read_field(value, *names):
    """Read a field from an SDK object or dictionary."""
    if value is None:
        return None

    for name in names:
        if isinstance(value, dict):
            result = value.get(name)
        else:
            result = getattr(value, name, None)

        if result is not None:
            return result

    return None


def _nonnegative_int(value):
    """Convert a genuine non-negative token count to an integer."""
    if value is None or isinstance(value, bool):
        return None

    try:
        number = int(value)
    except (TypeError, ValueError, OverflowError):
        return None

    if number < 0:
        return None

    # Avoid silently accepting fractional numeric values.
    try:
        if float(value) != number:
            return None
    except (TypeError, ValueError, OverflowError):
        return None

    return number


def _extract_usage(interaction):
    """
    Extract token counts from available Gemini usage metadata.

    Returns None when input/output counts cannot be established.
    The total is calculated from input + output only when Gemini
    doesn't supply a total count.
    """
    usage = _read_field(
        interaction,
        "usage",
        "usage_metadata",
        "usageMetadata",
    )

    if usage is None:
        return None

    input_tokens = _nonnegative_int(
        _read_field(
            usage,
            "input_tokens",
            "inputTokens",
            "input_token_count",
            "inputTokenCount",
            "prompt_tokens",
            "promptTokenCount",
            "prompt_token_count",
        )
    )

    output_tokens = _nonnegative_int(
        _read_field(
            usage,
            "output_tokens",
            "outputTokens",
            "output_token_count",
            "outputTokenCount",
            "candidates_token_count",
            "candidatesTokenCount",
        )
    )

    total_tokens = _nonnegative_int(
        _read_field(
            usage,
            "total_tokens",
            "totalTokens",
            "total_token_count",
            "totalTokenCount",
        )
    )

    # Don't store records with missing input/output counts as zero.
    if input_tokens is None or output_tokens is None:
        return None

    # A derived total is exact when both components are known.
    if total_tokens is None:
        total_tokens = input_tokens + output_tokens

    return {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
    }


async def _save_usage(
    interaction,
    operation: str,
    conversation_id: int | None = None,
):
    """
    Persist usage in a separate short-lived database session.

    Usage logging errors are intentionally contained so a successful
    Gemini response or ticket operation isn't lost because analytics
    storage failed.
    """
    try:
        usage = _extract_usage(interaction)

        if usage is None:
            logger.info(
                "Usage record skipped: usable token metadata unavailable; "
                "operation=%s model=%s interaction_id=%s",
                operation,
                MODEL,
                getattr(interaction, "id", None),
            )
            return

        async with SessionLocal() as session:
            record = AIUsageLog(
                conversation_id=conversation_id,
                interaction_id=getattr(interaction, "id", None),
                model=MODEL,
                operation=operation,
                input_tokens=usage["input_tokens"],
                output_tokens=usage["output_tokens"],
                total_tokens=usage["total_tokens"],
            )

            session.add(record)
            await session.commit()

        logger.info(
            "Persisted Gemini usage: operation=%s model=%s "
            "input_tokens=%s output_tokens=%s total_tokens=%s",
            operation,
            MODEL,
            usage["input_tokens"],
            usage["output_tokens"],
            usage["total_tokens"],
        )

    except Exception:
        logger.exception(
            "Could not persist Gemini usage; operation=%s",
            operation,
        )


# --------------------------------------------------
# General text generation
# --------------------------------------------------

async def generate_response(
    message: str,
    previous_interaction_id: str | None = None,
    conversation_id: int | None = None,
):
    """Generate a normal customer-support response and record usage."""

    logger.info("Sending general request to Gemini.")

    try:
        interaction = await asyncio.to_thread(
            client.interactions.create,
            model=GENERAL_MODEL,
            input=message,
            previous_interaction_id=previous_interaction_id,
            system_instruction="""
You are a professional customer support assistant.

- Help customers clearly and politely.
- Give concise and useful answers.
- Never invent company policies, prices, or product information.
- If information is unavailable, say so clearly.
- If a customer needs human assistance, recommend contacting support.
""",
            generation_config={"thinking_level": "low"},
        )

        await _save_usage(
            interaction,
            operation="general_response",
            conversation_id=conversation_id,
        )

        logger.info("General Gemini request completed.")

        return interaction.output_text, interaction.id

    except Exception:
        logger.exception("General Gemini request failed.")
        raise


# --------------------------------------------------
# Structured RAG response
# --------------------------------------------------

async def generate_structured_response(
    prompt: str,
    previous_interaction_id: str | None = None,
    conversation_id: int | None = None,
):
    """
    Generate and validate a structured RAG response.

    Usage is persisted after the Gemini interaction completes.
    """
    logger.info("Sending structured RAG request to Gemini.")

    try:
        interaction = await asyncio.to_thread(
            client.interactions.create,
            model=MODEL,
            input=prompt,
            previous_interaction_id=previous_interaction_id,
            generation_config={"thinking_level": "low"},
        )

        await _save_usage(
            interaction,
            operation="structured_rag",
            conversation_id=conversation_id,
        )

        logger.info("Gemini returned the structured RAG response.")

        output_text = interaction.output_text

        if not output_text:
            raise ValueError("Gemini returned an empty response.")

        data = json.loads(output_text)
        result = AIResponse.model_validate(data)

        return result, interaction.id

    except Exception:
        logger.exception("Structured Gemini request failed.")
        raise


# --------------------------------------------------
# Ticket tool helpers
# --------------------------------------------------

async def _create_ticket_if_conversation_valid(
    db: AsyncSession,
    customer_id: int,
    conversation_id: int,
    arguments: dict,
):
    """Validate conversation ownership before creating a ticket."""

    query = select(Conversation).where(
        Conversation.id == conversation_id,
        Conversation.customer_id == customer_id,
    )

    result = await db.execute(query)
    conversation = result.scalar_one_or_none()

    if conversation is None:
        return {
            "error": "Conversation not found for this customer."
        }

    try:
        subject = arguments["subject"]
        description = arguments["description"]

        if not isinstance(subject, str) or not subject.strip():
            raise ValueError("A non-empty ticket subject is required.")

        if not isinstance(description, str) or not description.strip():
            raise ValueError("A non-empty ticket description is required.")

        ticket = await create_ticket(
            db=db,
            customer_id=customer_id,
            conversation_id=conversation_id,
            subject=subject.strip()[:255],
            description=description.strip(),
        )

        return {
            "ticket_id": ticket.id,
            "subject": ticket.subject,
            "status": ticket.status,
        }

    except (KeyError, TypeError, ValueError) as exc:
        return {"error": f"Invalid ticket arguments: {exc}"}


# --------------------------------------------------
# Gemini function calling + ticket creation
# --------------------------------------------------

async def generate_response_with_ticket_tool(
    prompt: str,
    db: AsyncSession,
    customer_id: int,
    conversation_id: int,
    previous_interaction_id: str | None = None,
):
    """
    Execute ticket-tool calls and return:
    (final_text, interaction_id, created_tickets).
    """

    logger.info("Sending ticket-tool request to Gemini.")

    try:
        interaction = await asyncio.to_thread(
            client.interactions.create,
            model=MODEL,
            input=prompt,
            previous_interaction_id=previous_interaction_id,
            tools=[TICKET_TOOL],
            system_instruction="""
You are a professional customer support assistant.

- Use the supplied customer-support context when answering.
- Never invent company policies or facts.
- Create a ticket when the customer explicitly requests human help
  or has an unresolved issue requiring follow-up.
- Do not create tickets for ordinary questions.
- Never claim a ticket was created unless the backend confirms success.
""",
            generation_config={"thinking_level": "low"},
        )

        await _save_usage(
            interaction,
            operation="ticket_tool_decision",
            conversation_id=conversation_id,
        )

        logger.info("Gemini ticket-tool decision received.")

    except Exception:
        logger.exception("Gemini ticket-tool request failed.")
        raise

    created_tickets = []
    function_results = []

    for step in interaction.steps:
        if (
            step.type != "function_call"
            or step.name != "create_support_ticket"
        ):
            continue

        arguments = step.arguments

        if not isinstance(arguments, dict):
            function_result = {
                "error": "Ticket tool arguments must be an object."
            }
        else:
            function_result = await _create_ticket_if_conversation_valid(
                db=db,
                customer_id=customer_id,
                conversation_id=conversation_id,
                arguments=arguments,
            )

        if "ticket_id" in function_result:
            created_tickets.append(function_result)

        function_results.append({
            "type": "function_result",
            "name": step.name,
            "call_id": step.id,
            "result": [
                {
                    "type": "text",
                    "text": json.dumps(function_result),
                }
            ],
        })

    if not function_results:
        return (
            interaction.output_text or "",
            interaction.id,
            created_tickets,
        )

    logger.info("Sending ticket-tool results back to Gemini.")

    try:
        final_interaction = await asyncio.to_thread(
            client.interactions.create,
            model=MODEL,
            previous_interaction_id=interaction.id,
            input=function_results,
            generation_config={"thinking_level": "low"},
        )

        await _save_usage(
            final_interaction,
            operation="ticket_tool_followup",
            conversation_id=conversation_id,
        )

        logger.info("Gemini completed the ticket-tool interaction.")

    except Exception:
        logger.exception("Gemini follow-up after tool execution failed.")

        ticket_ids = ", ".join(
            f"#{ticket['ticket_id']}" for ticket in created_tickets
        )

        fallback_text = (
            f"Your support ticket(s) {ticket_ids} were created successfully."
            if created_tickets
            else "I couldn't complete the support response. Please try again."
        )

        return fallback_text, interaction.id, created_tickets

    return (
        final_interaction.output_text or "",
        final_interaction.id,
        created_tickets,
    )
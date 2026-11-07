def split_long_text(
    text: str,
    chunk_size: int,
    overlap: int
) -> list[str]:

    chunks = []

    start = 0

    while start < len(text):

        end = start + chunk_size

        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        if end >= len(text):
            break

        start = end - overlap

    return chunks


def chunk_text(
    text: str,
    chunk_size: int = 1000,
    overlap: int = 200
) -> list[str]:

    paragraphs = [
        paragraph.strip()
        for paragraph in text.split("\n\n")
        if paragraph.strip()
    ]

    chunks = []
    current_chunk = ""

    for paragraph in paragraphs:

        # Handle paragraphs larger than the target size
        if len(paragraph) > chunk_size:

            if current_chunk:
                chunks.append(current_chunk)
                current_chunk = ""

            chunks.extend(
                split_long_text(
                    paragraph,
                    chunk_size,
                    overlap
                )
            )

            continue

        if not current_chunk:
            current_chunk = paragraph
            continue

        candidate = current_chunk + "\n\n" + paragraph

        if len(candidate) <= chunk_size:
            current_chunk = candidate

        else:
            chunks.append(current_chunk)

            overlap_text = current_chunk[-overlap:]

            current_chunk = (
                overlap_text
                + "\n\n"
                + paragraph
            )

    if current_chunk:
        chunks.append(current_chunk)

    return chunks


def chunk_pages(
    pages: list[tuple[int, str]],
    chunk_size: int = 1000,
    overlap: int = 200
) -> list[tuple[int, str]]:

    chunks = []

    for page_number, text in pages:

        page_chunks = chunk_text(
            text,
            chunk_size=chunk_size,
            overlap=overlap
        )

        for chunk in page_chunks:
            chunks.append(
                (page_number, chunk)
            )

    return chunks
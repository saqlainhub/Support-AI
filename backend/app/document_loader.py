from pypdf import PdfReader


def extract_pages_from_pdf(file_path: str) -> list[tuple[int, str]]:
    reader = PdfReader(file_path)

    pages = []

    for page_number, page in enumerate(reader.pages, start=1):
        text = page.extract_text()

        if text:
            pages.append(
                (page_number, text.strip())
            )

    return pages
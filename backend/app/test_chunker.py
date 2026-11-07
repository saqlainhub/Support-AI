from app.document_loader import extract_pages_from_pdf
from app.chunker import chunk_pages


pages = extract_pages_from_pdf(
    r"D:\Work\Customer Support System\test.pdf"
)

chunks = chunk_pages(
    pages,
    chunk_size=100,
    overlap=20
)

for i, (page_number, chunk) in enumerate(chunks, start=1):
    print(f"\n--- Chunk {i} | Page {page_number} ---")
    print(chunk)
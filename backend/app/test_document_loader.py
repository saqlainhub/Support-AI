from app.document_loader import extract_pages_from_pdf


pages = extract_pages_from_pdf(
    r"D:\Work\Customer Support System\test.pdf"
)

for page_number, text in pages:
    print(f"\n--- Page {page_number} ---")
    print(text)
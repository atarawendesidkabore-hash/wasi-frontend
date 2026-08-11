"""Convert all investor HTML files to PDF using Playwright."""
from playwright.sync_api import sync_playwright
import glob
import os

DIR = os.path.dirname(os.path.abspath(__file__))
html_files = sorted(glob.glob(os.path.join(DIR, "*.html")))

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()

    for html_path in html_files:
        basename = os.path.splitext(os.path.basename(html_path))[0]
        pdf_path = os.path.join(DIR, f"{basename}.pdf")
        file_url = "file:///" + html_path.replace("\\", "/")

        page.goto(file_url, wait_until="networkidle")
        page.pdf(
            path=pdf_path,
            format="A4",
            margin={"top": "20mm", "bottom": "20mm", "left": "15mm", "right": "15mm"},
            print_background=True,
        )
        print(f"PDF  {basename}.pdf")

    browser.close()

print(f"\n{len(html_files)} PDF generes dans {DIR}")

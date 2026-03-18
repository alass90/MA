import asyncio
import os
from playwright.async_api import async_playwright
import tempfile

async def generate_pdf():
    base_dir = r"C:\Users\Microsoft\hope\MA\backend\core\templates\presentations\cyberpunk"
    slides = ["slide_01.html", "slide_02.html", "slide_03.html"]
    
    # We will concatenate the slides into a single HTML file to render
    combined_html = "<html><head><style>@page { size: 1920px 1080px; margin: 0; } body { margin: 0; padding: 0; }</style></head><body>"
    
    for slide in slides:
        with open(os.path.join(base_dir, slide), "r", encoding="utf-8") as f:
            content = f.read()
            # Extract body content
            body_start = content.find("<body>") + 6
            body_end = content.find("</body>")
            body_content = content[body_start:body_end]
            
            # Extract head styles
            style_start = content.find("<style>")
            style_end = content.find("</style>") + 8
            if style_start != -1:
                styles = content[style_start:style_end]
                combined_html = combined_html.replace("</head>", f"{styles}</head>")
            
            # Add page break
            combined_html += f"<div style='width: 1920px; height: 1080px; overflow: hidden; page-break-after: always; position: relative;'>{body_content}</div>"
    
    combined_html += "</body></html>"
    
    temp_path = os.path.join(base_dir, "temp_combined.html")
    with open(temp_path, "w", encoding="utf-8") as f:
        f.write(combined_html)
        
    out_pdf = os.path.join(base_dir, "pdf", "demo.pdf")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        # use file:// protocol
        file_url = f"file:///{temp_path.replace(os.sep, '/')}"
        await page.goto(file_url, wait_until="networkidle")
        await page.pdf(
            path=out_pdf,
            width="1920px",
            height="1080px",
            print_background=True,
            page_ranges="1-3"
        )
        await browser.close()
        
    print(f"Generated {out_pdf}")

if __name__ == "__main__":
    asyncio.run(generate_pdf())

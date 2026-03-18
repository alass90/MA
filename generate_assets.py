import asyncio
import os
import sys
from playwright.async_api import async_playwright

async def generate_assets(template_id):
    base_dir = os.path.join(r"C:\Users\Microsoft\hope\MA\backend\core\templates\presentations", template_id)
    pdf_dir = os.path.join(base_dir, "pdf")
    os.makedirs(pdf_dir, exist_ok=True)
    
    # Slides to concatenate
    slides = [f"slide_{str(i).zfill(2)}.html" for i in range(1, 6)]
    
    # 1. Combine HTML for PDF
    combined_html = "<html><head><style>@page { size: 1920px 1080px; margin: 0; } body { margin: 0; padding: 0; }</style></head><body>"
    
    for slide in slides:
        slide_path = os.path.join(base_dir, slide)
        if not os.path.exists(slide_path):
            continue
            
        with open(slide_path, "r", encoding="utf-8") as f:
            content = f.read()
            body_start = content.find("<body>") + 6
            body_end = content.find("</body>")
            body_content = content[body_start:body_end]
            
            style_start = content.find("<style>")
            style_end = content.find("</style>") + 8
            if style_start != -1:
                styles = content[style_start:style_end]
                combined_html = combined_html.replace("</head>", f"{styles}</head>")
            
            combined_html += f"<div style='width: 1920px; height: 1080px; overflow: hidden; page-break-after: always; position: relative;'>{body_content}</div>"
    
    combined_html += "</body></html>"
    temp_path = os.path.join(base_dir, "temp_combined.html")
    with open(temp_path, "w", encoding="utf-8") as f:
        f.write(combined_html)
        
    out_pdf = os.path.join(pdf_dir, "demo.pdf")
    out_thumb = os.path.join(r"C:\Users\Microsoft\hope\MA\frontend\public\images\presentation-templates", f"{template_id}-min.png")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1920, "height": 1080})
        
        # Take screenshot of slide 1 for thumbnail
        slide1_url = f"file:///{os.path.join(base_dir, 'slide_01.html').replace(os.sep, '/')}"
        await page.goto(slide1_url, wait_until="networkidle")
        await page.screenshot(path=out_thumb, type="png")
        print(f"[{template_id}] Thumbnail saved to {out_thumb}")
        
        # Render PDF
        file_url = f"file:///{temp_path.replace(os.sep, '/')}"
        await page.goto(file_url, wait_until="networkidle")
        await page.pdf(
            path=out_pdf,
            width="1920px",
            height="1080px",
            print_background=True,
            page_ranges="1-5"
        )
        print(f"[{template_id}] PDF generated at {out_pdf}")
        
        await browser.close()
    
    if os.path.exists(temp_path):
        os.remove(temp_path)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        asyncio.run(generate_assets(sys.argv[1]))
    else:
        print("Please provide a template_id")

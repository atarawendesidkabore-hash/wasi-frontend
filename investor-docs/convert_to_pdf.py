"""Convert all investor MD files to styled HTML files, then open them for Print-to-PDF."""
import markdown
import os
import glob
import subprocess

DIR = os.path.dirname(os.path.abspath(__file__))

CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Inter', -apple-system, sans-serif;
  background: #fff; color: #1a1a2e;
  max-width: 800px; margin: 0 auto; padding: 48px 40px;
  font-size: 13px; line-height: 1.7;
}
h1 { font-size: 24px; font-weight: 700; color: #0a1628; margin: 32px 0 16px; border-bottom: 3px solid #C8922A; padding-bottom: 8px; }
h2 { font-size: 18px; font-weight: 600; color: #0a1628; margin: 28px 0 12px; }
h3 { font-size: 14px; font-weight: 600; color: #333; margin: 20px 0 8px; }
p { margin: 8px 0; }
ul, ol { margin: 8px 0 8px 24px; }
li { margin: 4px 0; }
table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
th { background: #0a1628; color: #fff; padding: 10px 12px; text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
td { padding: 8px 12px; border-bottom: 1px solid #e5e5e5; }
tr:nth-child(even) td { background: #f8f7f5; }
tr:hover td { background: #f0ede8; }
blockquote { border-left: 4px solid #C8922A; padding: 12px 16px; margin: 16px 0; background: #faf8f4; color: #555; font-style: italic; }
code { background: #f4f2ee; padding: 2px 6px; border-radius: 3px; font-size: 12px; font-family: 'Consolas', monospace; }
pre { background: #0a1628; color: #e8e6e3; padding: 16px; border-radius: 6px; margin: 16px 0; overflow-x: auto; }
pre code { background: none; color: inherit; padding: 0; }
hr { border: none; border-top: 2px solid #C8922A; margin: 32px 0; }
strong { color: #0a1628; }
em { color: #555; }
.header-bar { background: #0a1628; color: #C8922A; padding: 12px 20px; margin: -48px -40px 32px; font-family: 'Consolas', monospace; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; }
@media print {
  body { padding: 20px; font-size: 11px; }
  h1 { font-size: 20px; }
  h2 { font-size: 15px; }
  table { font-size: 10px; }
  pre { font-size: 10px; }
}
</style>
"""

md_files = sorted(glob.glob(os.path.join(DIR, "*.md")))
html_files = []

for md_path in md_files:
    basename = os.path.splitext(os.path.basename(md_path))[0]
    html_path = os.path.join(DIR, f"{basename}.html")

    with open(md_path, "r", encoding="utf-8") as f:
        md_content = f.read()

    html_body = markdown.markdown(md_content, extensions=["tables", "fenced_code"])

    html_full = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{basename}</title>
{CSS}
</head>
<body>
<div class="header-bar">WASI — Whole African Strategic Intelligence &bull; Confidentiel Investisseur</div>
{html_body}
</body>
</html>"""

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_full)

    html_files.append(html_path)
    print(f"OK  {basename}.html")

print(f"\n{len(html_files)} fichiers HTML generes dans {DIR}")
print("\nPour generer les PDF : ouvrir chaque HTML dans le navigateur -> Ctrl+P -> Enregistrer en PDF")
print("\nOu ouvrir tous les fichiers maintenant :")

for hp in html_files:
    print(f"  {hp}")

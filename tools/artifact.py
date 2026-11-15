"""Turn the single-file build (dist/index.html) into an Artifact page body: no doctype/html/head/body tags,
<title> first. usage: python3 tools/artifact.py dist/index.html web/delivery-academy.html"""
import re, sys
src, out = sys.argv[1], sys.argv[2]
s = open(src, encoding="utf-8").read()
head = re.search(r"<head[^>]*>(.*?)</head>", s, re.S).group(1)
body = re.search(r"<body[^>]*>(.*)</body>", s, re.S).group(1)
title = re.search(r"<title>.*?</title>", head, re.S).group(0)
head = head.replace(title, "")
head = re.sub(r'<meta charset="[^"]*"\s*/?>', "", head, flags=re.I)
head = re.sub(r'<meta name="viewport"[^>]*>', "", head, flags=re.I)
head = re.sub(r'<link rel="icon"[^>]*>', "", head, flags=re.I)
page = title + "\n" + head.strip() + "\n" + body.strip() + "\n"
open(out, "w", encoding="utf-8").write(page)
print(f"{out}: {len(page)/1e6:.2f} MB")

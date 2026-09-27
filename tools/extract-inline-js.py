import io,re,sys
s=io.open(sys.argv[1],encoding='utf-8').read()
# Strip HTML comments FIRST. A comment on line 661 mentions "<script>" in prose,
# and matching that as a real tag made the following English parse as JavaScript.
s = re.sub(r'<!--.*?-->', '', s, flags=re.S)
out=[]
for m in re.finditer(r'<script([^>]*)>(.*?)</script>', s, re.S):
    attrs, body = m.group(1), m.group(2)
    if 'src=' in attrs: continue
    t = re.search(r'type\s*=\s*["\']([^"\']+)', attrs)
    if t and 'json' in t.group(1).lower(): continue
    if t and 'javascript' not in t.group(1).lower() and 'module' not in t.group(1).lower(): continue
    out.append(body)
print("\n;\n".join(out))

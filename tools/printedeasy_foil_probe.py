"""Price foiling at PrintedEasy. Keeps the scodix fields the repo scraper drops."""
import urllib.request, urllib.parse, http.cookiejar, json, re, time, sys
from html.parser import HTMLParser

BASE='https://www.printedeasy.com'
UA=('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
    '(KHTML, like Gecko) Chrome/124 Safari/537.36')

class FormReader(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.fields, self._sel, self._first, self._seen = {}, None, None, False
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if tag=='input':
            n,t,v=a.get('name'),(a.get('type') or 'text').lower(),a.get('value','')
            if not n: return
            if t in ('hidden','text','number'): self.fields[n]=v
            elif t in ('radio','checkbox') and 'checked' in a: self.fields[n]=v
        elif tag=='select':
            self._sel,self._first,self._seen=a.get('name'),None,False
        elif tag=='option' and self._sel:
            v=a.get('value','')
            if self._first is None: self._first=v
            if 'selected' in a: self.fields[self._sel],self._seen=v,True
    def handle_endtag(self,tag):
        if tag=='select' and self._sel:
            if not self._seen: self.fields[self._sel]=self._first or ''
            self._sel=None

class PE:
    def __init__(self):
        cj=http.cookiejar.CookieJar()
        self.op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
        self.op.addheaders=[('User-Agent',UA)]
        self._f={}
        self.calls=0
    def form(self,slug):
        if slug not in self._f:
            html=self.op.open(f'{BASE}/products/{slug}',timeout=40).read().decode('utf8','replace')
            fr=FormReader(); fr.feed(html); f=fr.fields
            m=re.search(r'name="_token"\s+value="([^"]+)"',html)
            if m: f['_token']=m.group(1)
            self._f[slug]=f
            self._html=html
        return dict(self._f[slug])
    def raw(self,slug,**over):
        body={k:('' if v is None else str(v)) for k,v in {**self.form(slug),**over}.items()}
        req=urllib.request.Request(f'{BASE}/product/pricing/{slug}',
            data=urllib.parse.urlencode(body).encode(),
            headers={'Content-Type':'application/x-www-form-urlencoded',
                     'X-Requested-With':'XMLHttpRequest','User-Agent':UA,
                     'Referer':f'{BASE}/products/{slug}'})
        self.calls+=1
        time.sleep(0.5)                      # their server, our manners
        return json.loads(self.op.open(req,timeout=40).read().decode())
    def price(self,slug,**over):
        d=self.raw(slug,**over)
        v=d.get('totalSellingPrice')
        try: return float(v)
        except (TypeError,ValueError): return None

NOFOIL=dict(scodix_foil='', scodix_spotUV='')
def foil(**kw):
    """Foiling on, with every field the form carries, overridable."""
    f=dict(NOFOIL)
    f.update({'scodix_foil':'true','scodix_foil_sides':'1',
              'scodix_foil_different_guide':'false','scodix_foil_number_of_areas':'1',
              'scodix_foil_build_height':'flat','scodix_foil_coverage_percent':'1',
              'foil-price':'no','showScodix':'1'})
    f.update(kw); return f

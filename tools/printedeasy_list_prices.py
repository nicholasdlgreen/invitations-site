#!/usr/bin/env python3
"""PrintedEasy's LIST price — what a consumer pays buying direct from the
company we buy from. We pay 20% less; this is the retail number to compare."""
import importlib.util
spec = importlib.util.spec_from_file_location('pe','tools/printedeasy_refresh.py')
M = importlib.util.module_from_spec(spec); spec.loader.exec_module(M)
pe = M.PrintedEasy()
QTY = [25,50,100,250]
print('%-8s %-12s %s' % ('size','stock', ''.join('%9s'%('x%d'%q) for q in QTY)))
for size,(w,h) in [('A5',('148','210')), ('A6',('105','148'))]:
    for label,stock,gsm in [('silk 300','silk',300), ('uncoated 300','uncoated',300)]:
        row=[]
        for q in QTY:
            d = pe.price('postcards', size=size, width='', height='', quantity=q,
                         **{'stock-finish':stock,'stock-weight':gsm,'printed-sides':'single'})
            v = d.get('totalSellingPrice')
            row.append('£%.2f'%float(v) if v else '—')
        print('%-8s %-12s %s' % (size, label, ''.join('%9s'%c for c in row)))

import pathlib, json, datetime, openpyxl, collections
root=pathlib.Path('.private/source')
for p in root.glob('*.xlsx'):
 w=openpyxl.load_workbook(p,data_only=True)
 f=openpyxl.load_workbook(p,data_only=False)
 print('\nFILE',p.name)
 for s in w:
  cells=[c for c in s._cells.values() if c.value is not None]
  print('SHEET',s.title,'nonempty',len(cells))
  if p.name.startswith('01.'):
   rows=[]
   for r in range(5,s.max_row+1):
    vals=[s.cell(r,c).value for c in range(1,min(22,s.max_column+1))]
    raw=[f[s.title].cell(r,c).value for c in range(1,min(22,s.max_column+1))]
    if any(v is not None and not (isinstance(v,str) and v.startswith('=')) for v in raw):rows.append((r,vals))
   print('rows with inputs',len(rows),'last',rows[-2:])
   if s.title in ['Recebimentos','Movimentacoes','Danificados']: print('first',rows[:3])
  else:
   for row in s.iter_rows(values_only=True):print(row)

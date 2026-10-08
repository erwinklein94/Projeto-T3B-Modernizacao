"""Read-only extraction. Source workbooks never change; private payload is never published."""
import pathlib, json, datetime, hashlib, openpyxl, collections
root=pathlib.Path('.private/source')
out=pathlib.Path('.private'); pathlib.Path('src').mkdir(exist_ok=True)
def val(v):
 if isinstance(v,(datetime.datetime,datetime.date)):return v.isoformat()[:10]
 if isinstance(v,datetime.time):return v.isoformat()
 return v
definitions=[]; records=[]; archive=[]; report=[]
names={'Recebimentos':'recebimentos','Movimentacoes':'movimentacoes','Danificados':'danificados','Devolucoes_Danificados':'devolucoes','Conciliacao':'conciliacao','Consumo_Final':'consumo','Transferencias':'transferencias','Propriedades da Madeira':'madeiras','Recebimento Semanal':'semanal','Danif.':'apuracoes','Parametros':'parametros'}
for p in root.glob('*.xlsx'):
 w=openpyxl.load_workbook(p,data_only=True); raw=openpyxl.load_workbook(p,data_only=False)
 for s in w:
  archive.append({'file':p.name,'sheet':s.title,'cells':[{'cell':c.coordinate,'value':val(c.value),'formula':raw[s.title][c.coordinate].value if raw[s.title][c.coordinate].data_type=='f' else None} for c in s._cells.values() if c.value is not None or raw[s.title][c.coordinate].data_type=='f']})
  if s.title not in names:continue
  kind=names[s.title]; hr=1 if kind=='madeiras' else 3 if kind=='semanal' else 2 if kind=='apuracoes' else 4
  limit=3 if kind=='apuracoes' else 6 if kind=='semanal' else 14 if kind=='parametros' else 11 if kind=='madeiras' else 19 if kind in ['recebimentos','movimentacoes','transferencias'] else 21 if kind in ['danificados','devolucoes'] else 17 if kind=='conciliacao' else 13
  headers=[str(s.cell(hr,c).value or f'Coluna {c}') for c in range(1,limit+1)]
  dates=set(); nums=set(); formulas={}; count=0; placeholders=0
  for r in range(hr+1,s.max_row+1):
   cells=[s.cell(r,c) for c in range(1,limit+1)]; values=[val(c.value) for c in cells]
   inputs=[raw[s.title].cell(r,c).value for c in range(1,limit+1)]
   hasdata=any(v is not None and not (isinstance(v,str) and v.startswith('=')) for v in inputs)
   if not hasdata:continue
   if kind=='recebimentos' and not any(values[i] is not None for i in [0,1,3,4,6,7,8,9,10]):placeholders+=1;continue
   if kind in ['semanal','apuracoes'] and str(values[0]).strip().upper()=='TOTAL':continue
   for i,c in enumerate(cells):
    if isinstance(c.value,(datetime.datetime,datetime.date)):dates.add(i)
    elif isinstance(c.value,(int,float)):nums.add(i)
    if raw[s.title].cell(r,i+1).data_type=='f':formulas.setdefault(str(i),raw[s.title].cell(r,i+1).value)
   records.append({'kind':kind,'cells':values,'source_key':hashlib.sha256(f'{p.name}:{s.title}:{r}'.encode()).hexdigest(),'source_file':p.name,'source_sheet':s.title,'source_row':r})
   count+=1
  definitions.append({'id':kind,'name':s.title.replace('_',' '),'sheet':s.title,'headers':headers,'dates':sorted(dates),'numbers':sorted(nums-dates),'formulas':formulas})
  report.append({'file':p.name,'sheet':s.title,'records':count,'template_rows_ignored':placeholders})
pathlib.Path('src/definitions.json').write_text(json.dumps(definitions,ensure_ascii=False,indent=2),encoding='utf8')
(out/'history.json').write_text(json.dumps(records,ensure_ascii=False),encoding='utf8')
(out/'source_archive.json').write_text(json.dumps(archive,ensure_ascii=False),encoding='utf8')
(out/'reconciliation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(report,ensure_ascii=False,indent=2))
for k,idxs in [('recebimentos',[9,10,11]),('movimentacoes',[6,7,8,9]),('danificados',[9,15,16])]:
 rows=[r for r in records if r['kind']==k]
 print(k,{i:sum(r['cells'][i] for r in rows if isinstance(r['cells'][i],(int,float))) for i in idxs})

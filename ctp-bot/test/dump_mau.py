# Đọc file mẫu xlsx → JSON cho bản giả lập Apps Script (giá trị, công thức, ô gộp, chiều cao dòng)
import json, sys, openpyxl, datetime
wb = openpyxl.load_workbook(sys.argv[1])
out = []
for i, ws in enumerate(wb.worksheets):
    cells = {}
    for row in ws.iter_rows():
        for c in row:
            if c.value is None: continue
            v = c.value
            if isinstance(v, datetime.datetime): v = v.strftime('%d/%m/%Y')
            cells[f'{c.row},{c.column}'] = v
    out.append({
        'name': ws.title, 'hidden': ws.sheet_state != 'visible', 'id': i + 1,
        'maxRow': ws.max_row, 'maxCol': ws.max_column,
        'merges': [[m.min_row, m.min_col, m.max_row, m.max_col] for m in ws.merged_cells.ranges],
        'heights': {str(r): d.height for r, d in ws.row_dimensions.items() if d.height},
        'cells': cells,
    })
json.dump(out, open(sys.argv[2], 'w'), ensure_ascii=False, indent=0)
print('ok', [s['name'] for s in out])

import CsvImportControl from './CsvImportControl';
import { downloadCsv } from '@/Utils/csv.mjs';

export default function ModuleWorkbookTools({ name, columns, rows, importColumns = columns, sample = [], onImport, description }) {
    const importRows = onImport;
    return <div className="mx-auto flex max-w-7xl justify-end px-6 py-3">
        <details className="relative"><summary className="clinic-file-action cursor-pointer">{importRows ? 'Import / Export' : 'Export'} <span aria-hidden="true">⌄</span></summary>
            <div className="absolute right-0 z-30 mt-2 w-[min(26rem,calc(100vw-2rem))] rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
                <button type="button" className="clinic-file-action mb-3" onClick={() => downloadCsv(name, columns, rows)}>Export current view · XLSX</button>
                {importRows && <CsvImportControl columns={importColumns} sample={sample} onImport={importRows} description={description || 'Import creates records using your normal permissions. Approval steps remain unchanged.'} />}
            </div>
        </details>
    </div>;
}

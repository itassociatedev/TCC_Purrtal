<?php

namespace App\Services;

use Illuminate\Support\Str;

class AccountabilityPdfService
{
    public function render($user, $personalAssets, $sharedAssets): string
    {
        $rows = [];
        $rows[] = ['text' => 'The Cat Clinic', 'size' => 11, 'bold' => true, 'y' => 760];
        $rows[] = ['text' => 'Asset Accountability Form', 'size' => 16, 'bold' => true, 'y' => 738];
        $rows[] = ['text' => 'Employee Information', 'size' => 11, 'bold' => true, 'y' => 700];
        $rows[] = ['text' => 'Name: ' . ($user->name ?? ''), 'size' => 10, 'y' => 684];
        $rows[] = ['text' => 'Department: ' . ($user->department?->name ?? ''), 'size' => 10, 'y' => 670];
        $rows[] = ['text' => 'Branch: ' . ($user->branches?->first()?->name ?? ''), 'size' => 10, 'y' => 656];
        $rows[] = ['text' => 'Date: ' . now()->format('n/j/y'), 'size' => 10, 'y' => 642];
        $rows[] = ['section' => 'Personal Accountability'];
        foreach ($personalAssets as $asset) $rows[] = ['asset' => $asset];
        $rows[] = ['section' => 'Shared Accountability'];
        foreach ($sharedAssets as $asset) $rows[] = ['asset' => $asset];
        $rows[] = ['section' => 'Acknowledgment'];
        $rows[] = ['text' => 'I acknowledge that the above asset(s) are assigned to me and I am responsible for their safekeeping and proper use. I understand that I must report any loss, damage, or transfer of the asset(s) to the IT Department immediately.', 'size' => 9];
        $rows[] = ['text' => 'Upon separation from the company or reassignment, I will return the asset(s) in good condition, subject to final inspection.', 'size' => 9];
        $rows[] = ['text' => 'Employee Signature: ______________________________    Date: ____________', 'size' => 10];
        $rows[] = ['text' => 'IT Dept. Representative: __________________________    Date: ____________', 'size' => 10];

        $pages = [[]]; $y = 620;
        foreach ($rows as $row) {
            if (isset($row['section'])) {
                if ($y < 95) { $pages[] = []; $y = 740; }
                $pages[array_key_last($pages)][] = ['text' => $row['section'], 'size' => 11, 'bold' => true, 'y' => $y]; $y -= 22;
                $pages[array_key_last($pages)][] = ['text' => 'Item                 Tag                  Serial Number / Model              Condition', 'size' => 8, 'y' => $y]; $y -= 16;
                continue;
            }
            if (isset($row['asset'])) {
                if ($y < 65) { $pages[] = []; $y = 740; }
                $asset = $row['asset'];
                $text = Str::limit(($asset->name ?: '') . '    ' . ($asset->asset_tag ?: '') . '    ' . ($asset->serial_no ?: ($asset->model_no ?: '')) . '    ' . ($asset->condition ?: ''), 105, '');
                $pages[array_key_last($pages)][] = ['text' => $text, 'size' => 8, 'y' => $y]; $y -= 15;
                continue;
            }
            if (isset($row['y'])) { $pages[array_key_last($pages)][] = $row; continue; }
            $wrapped = str_split($row['text'], 105);
            foreach ($wrapped as $line) {
                if ($y < 55) { $pages[] = []; $y = 740; }
                $pages[array_key_last($pages)][] = ['text' => $line, 'size' => $row['size'] ?? 10, 'bold' => $row['bold'] ?? false, 'y' => $y]; $y -= 14;
            }
        }
        return $this->pdf($pages);
    }

    private function pdf(array $pages): string
    {
        $count = count($pages); $font = 3 + ($count * 2); $objects = [];
        $objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        $kids = [];
        foreach ($pages as $i => $page) $kids[] = (3 + ($i * 2)) . ' 0 R';
        $objects[2] = '<< /Type /Pages /Kids [' . implode(' ', $kids) . '] /Count ' . $count . ' >>';
        foreach ($pages as $i => $page) {
            $pageObject = 3 + ($i * 2); $contentObject = $pageObject + 1; $stream = "q\n";
            foreach ($page as $row) {
                $size = $row['size'] ?? 10; $fontName = !empty($row['bold']) ? '/F1' : '/F1';
                $stream .= "BT {$fontName} {$size} Tf 50 " . (int) ($row['y'] ?? 700) . " Td (" . $this->escape($row['text']) . ") Tj ET\n";
            }
            $stream .= "Q\n";
            $objects[$pageObject] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ' . $font . ' 0 R >> >> /Contents ' . $contentObject . ' 0 R >>';
            $objects[$contentObject] = '<< /Length ' . strlen($stream) . " >>\nstream\n" . $stream . "endstream";
        }
        $objects[$font] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
        ksort($objects); $pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"; $offsets = [0];
        foreach ($objects as $number => $object) { $offsets[$number] = strlen($pdf); $pdf .= "{$number} 0 obj\n{$object}\nendobj\n"; }
        $xref = strlen($pdf); $pdf .= "xref\n0 " . ($font + 1) . "\n0000000000 65535 f \n";
        for ($i = 1; $i <= $font; $i++) $pdf .= sprintf('%010d 00000 n %s', $offsets[$i] ?? 0, "\n");
        $pdf .= "trailer\n<< /Size " . ($font + 1) . " /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF";
        return $pdf;
    }

    private function escape(string $text): string
    {
        $text = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text) ?: $text;
        return str_replace(['\\', '(', ')', "\r", "\n"], ['\\\\', '\\(', '\\)', ' ', ' '], $text);
    }
}

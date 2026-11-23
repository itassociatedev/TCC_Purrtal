<?php

namespace App\Services;

class AccountabilityPdfService
{
    private const BLUE = [0.24, 0.43, 0.62];

    public function render($user, $personalAssets, $sharedAssets): string
    {
        $commands = [];
        $y = 754;

        // Compact clinic mark and centered form title, matching the printed reference.
        $this->text($commands, 'The Cat Clinic', 0, $y, 7, true, true);
        $y -= 13;
        $this->text($commands, 'Asset Accountability Form', 0, $y, 14, true, true);
        $y -= 28;

        $this->heading($commands, 'Employee Information', 56, $y, 10);
        $y -= 17;
        $this->text($commands, 'Name: ' . ($user->name ?? ''), 60, $y, 9);
        $y -= 13;
        $this->text($commands, 'Department: ' . ($user->department?->name ?? ''), 60, $y, 9);
        $y -= 13;
        $this->text($commands, 'Branch: ' . ($user->branches?->first()?->name ?? ''), 60, $y, 9);
        $y -= 13;
        $this->text($commands, 'Date: ' . now()->format('n/j/y'), 60, $y, 9);
        $y -= 21;

        $this->sectionTable($commands, 'Personal Accountability', $personalAssets, $y);
        $this->sectionTable($commands, 'Shared Accountability', $sharedAssets, $y);

        $this->heading($commands, 'Acknowledgment', 60, $y, 10);
        $y -= 16;
        $ack = 'I acknowledge that the above asset(s) are assigned to me and I am responsible for their safekeeping and proper use. I understand that I must report any loss, damage, or transfer of the asset(s) to the IT Department immediately. Upon separation from the company or reassignment, I will return the asset(s) in good condition, subject to final inspection.';
        foreach ($this->wrap($ack, 104) as $line) {
            $this->text($commands, $line, 60, $y, 8.5);
            $y -= 12;
        }

        $y -= 17;
        $this->text($commands, 'Employee Signature:', 60, $y, 9);
        $this->line($commands, 145, $y - 2, 352, $y - 2);
        $this->text($commands, 'Date:', 404, $y, 9);
        $this->line($commands, 432, $y - 2, 552, $y - 2);
        $y -= 20;
        $this->text($commands, 'IT Dept. Representative:', 60, $y, 9);
        $this->line($commands, 164, $y - 2, 352, $y - 2);
        $this->text($commands, 'Date:', 404, $y, 9);
        $this->line($commands, 432, $y - 2, 552, $y - 2);

        return $this->pdf([$commands]);
    }

    private function sectionTable(array &$commands, string $title, $assets, float &$y): void
    {
        $this->heading($commands, $title, 60, $y, 10);
        $y -= 8;

        $left = 60;
        // The columns add up to 492pt: Letter page width minus 60pt side margins.
        $widths = [86, 60, 104, 64, 178];
        $headers = ['Item', 'Tag', 'Serial Number / Model', 'Condition', 'Remarks'];
        $headerHeight = 25;
        $this->tableRow($commands, $left, $y, $widths, $headers, $headerHeight, true);
        $y -= $headerHeight;

        $items = collect($assets);
        $rows = $items->isEmpty() ? [['', '', '', '', '']] : $items->map(fn ($asset) => [
            $asset->name ?? '',
            $asset->asset_tag ?? '',
            $asset->serial_no ?: ($asset->model_no ?: ''),
            $asset->condition ?? '',
            $asset->remarks ?? '',
        ])->all();

        // Keep enough room for the acknowledgment and both signatures on the same page.
        $maxRows = max(1, min(10, (int) floor(($y - 190) / 19)));
        foreach (array_slice($rows, 0, $maxRows) as $row) {
            $this->tableRow($commands, $left, $y, $widths, array_map(fn ($value) => (string) $value, $row), 19);
            $y -= 19;
        }
        if (count($rows) > $maxRows) {
            $this->text($commands, 'Additional assigned assets omitted; see the asset register.', $left, $y - 10, 7);
            $y -= 13;
        }
        $y -= 18;
    }

    private function tableRow(array &$commands, float $left, float $top, array $widths, array $values, float $height, bool $header = false): void
    {
        $x = $left;
        foreach ($widths as $index => $width) {
            $this->rect($commands, $x, $top - $height, $width, $height);
            $label = $values[$index] ?? '';
            $fontSize = $header ? 7.4 : 7.3;
            $lines = $this->wrap($label, max(8, (int) floor($width / ($fontSize * 0.52))));
            $lineY = $top - ($header ? 10 : 12);
            foreach (array_slice($lines, 0, $header ? 2 : 2) as $line) {
                $this->text($commands, $line, $x + 3, $lineY, $fontSize, false, false, $header);
                $lineY -= 8;
            }
            $x += $width;
        }
    }

    private function heading(array &$commands, string $label, float $x, float $y, float $size): void
    {
        $this->text($commands, $label, $x, $y, $size, true, false, false, self::BLUE);
    }

    private function text(array &$commands, string $value, float $x, float $y, float $size, bool $bold = false, bool $centered = false, bool $blue = false, ?array $color = null): void
    {
        $rawValue = $value;
        $value = $this->escape($value);
        $font = $bold ? '/F2' : '/F1';
        $rgb = $color ?? ($blue ? self::BLUE : [0, 0, 0]);
        $commands[] = sprintf("%.3f %.3f %.3f rg", ...$rgb);
        if ($centered) {
            $x = (612 - strlen($rawValue) * $size * 0.52) / 2;
            $commands[] = sprintf('BT %s %.2f Tf 1 0 0 1 %.2f %.2f Tm (%s) Tj ET', $font, $size, $x, $y, $value);
        } else {
            $commands[] = sprintf('BT %s %.2f Tf 1 0 0 1 %.2f %.2f Tm (%s) Tj ET', $font, $size, $x, $y, $value);
        }
    }

    private function line(array &$commands, float $x1, float $y1, float $x2, float $y2): void
    {
        $commands[] = sprintf('0.25 0.25 0.25 RG 0.55 w %.2f %.2f m %.2f %.2f l S', $x1, $y1, $x2, $y2);
    }

    private function rect(array &$commands, float $x, float $y, float $width, float $height): void
    {
        $commands[] = sprintf('0.35 0.35 0.35 RG 0.45 w %.2f %.2f %.2f %.2f re S', $x, $y, $width, $height);
    }

    private function wrap(string $text, int $width): array
    {
        $text = trim(preg_replace('/\s+/', ' ', $text) ?? $text);
        return $text === '' ? [''] : (preg_split('/\n/', wordwrap($text, $width, "\n", true)) ?: [$text]);
    }

    private function pdf(array $pages): string
    {
        $count = count($pages);
        $fontRegular = 3 + ($count * 2);
        $fontBold = $fontRegular + 1;
        $objects = [1 => '<< /Type /Catalog /Pages 2 0 R >>'];
        $kids = [];
        foreach ($pages as $i => $page) {
            $pageObject = 3 + ($i * 2);
            $contentObject = $pageObject + 1;
            $kids[] = $pageObject . ' 0 R';
            $stream = "q\n" . implode("\n", $page) . "\nQ\n";
            $objects[$pageObject] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ' . $fontRegular . ' 0 R /F2 ' . $fontBold . ' 0 R >> >> /Contents ' . $contentObject . ' 0 R >>';
            $objects[$contentObject] = '<< /Length ' . strlen($stream) . ">>\nstream\n" . $stream . 'endstream';
        }
        $objects[2] = '<< /Type /Pages /Kids [' . implode(' ', $kids) . '] /Count ' . $count . ' >>';
        $objects[$fontRegular] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
        $objects[$fontBold] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
        ksort($objects);

        $pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
        $offsets = [0];
        foreach ($objects as $number => $object) {
            $offsets[$number] = strlen($pdf);
            $pdf .= "{$number} 0 obj\n{$object}\nendobj\n";
        }
        $xref = strlen($pdf);
        $size = max(array_keys($objects)) + 1;
        $pdf .= "xref\n0 {$size}\n0000000000 65535 f \n";
        for ($i = 1; $i < $size; $i++) $pdf .= sprintf('%010d 00000 n ', $offsets[$i] ?? 0) . "\n";
        return $pdf . "trailer\n<< /Size {$size} /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF";
    }

    private function escape(string $text): string
    {
        $text = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text) ?: $text;
        return str_replace(['\\', '(', ')', "\r", "\n"], ['\\\\', '\\(', '\\)', ' ', ' '], $text);
    }
}

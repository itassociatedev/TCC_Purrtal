<?php

namespace App\Services;

/**
 * Builds the "Asset Accountability Form" PDF for one or many employees with the project's
 * dependency-free PDF writer (same approach as AccountabilityPdfService, but A4 and multi-employee).
 *
 * Layout rules (see mockups/asset-pdf/README.md):
 *  - one form per employee, each starting on a new page
 *  - rows are never split across pages and the table header repeats on every page
 *  - continuation pages use a compact header and "(continued)" section titles
 *  - the acknowledgment and signature lines always stay together as one block
 *  - every page has a footer: employee name, "Page X of Y" (whole PDF) and the generated date
 *
 * Coordinates are PDF points on A4 portrait (595.28 x 841.89), origin bottom-left.
 */
class AssetAccountabilityFormPdfService
{
    private const PAGE_WIDTH = 595.28;

    private const PAGE_HEIGHT = 841.89;

    private const LEFT = 34.0;

    private const RIGHT = 561.28;

    private const TOP = 808.0;

    /** Lowest y that content may reach; the footer lives below this. */
    private const BOTTOM = 54.0;

    private const BLUE = [0.176, 0.290, 0.451];

    private const LABEL = [0.294, 0.365, 0.451];

    private const MUTED = [0.420, 0.478, 0.549];

    private const FAINT = [0.545, 0.592, 0.659];

    private const INK = [0.122, 0.161, 0.216];

    private const GRID = [0.788, 0.827, 0.871];

    private const HEAD_FILL = [0.933, 0.949, 0.969];

    /** Column share of the table width: Item, Tag, Serial Number / Model, Condition, Remarks. */
    private const COLUMNS = [0.24, 0.18, 0.23, 0.13, 0.22];

    private const HEADERS = ['Item', 'Tag', 'Serial Number / Model', 'Condition', 'Remarks'];

    private const ACKNOWLEDGMENT = 'I acknowledge that the above asset(s) are assigned to me and I am responsible for their safekeeping and proper use. I understand that I must report any loss, damage, or transfer of the asset(s) to the IT Department immediately. Upon separation from the company or reassignment, I will return the asset(s) in good condition, subject to final inspection.';

    /** Helvetica advance widths (1/1000 em) for ASCII 32..126. */
    private const HELVETICA = [
        278, 278, 355, 556, 556, 889, 667, 222, 333, 333, 389, 584, 278, 333, 278, 278,
        556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
        1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
        667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
        333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
        556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
    ];

    /** @var array<int, array{commands: array<int, string>, label: string}> */
    private array $pages = [];

    private array $commands = [];

    private float $y = 0;

    private string $label = '';

    private string $continuedLabel = '';

    private string $generated = '';

    /** @var array{string, int, int}|null */
    private ?array $logo = null;

    /**
     * @param  iterable<int, array{user: mixed, personal: iterable, shared: iterable}>  $forms
     * @param  iterable  $unassigned  Assets with nobody accountable; listed at the end without signatures.
     */
    public function render(iterable $forms, iterable $unassigned = []): string
    {
        $this->pages = [];
        $this->commands = [];
        $this->generated = now()->format('n/j/y');
        $this->logo = app(AccountabilityPdfService::class)->logoJpeg();

        foreach ($forms as $form) {
            $this->employeeForm($form['user'], collect($form['personal']), collect($form['shared']));
        }

        $unassigned = collect($unassigned)->values();
        if ($unassigned->isNotEmpty()) {
            $this->label = 'Unassigned assets';
            $this->continuedLabel = 'Selection · unassigned assets';
            $this->continuationPage();
            $this->assetSection('Unassigned Assets', $unassigned);
            $this->closePage();
        }

        if ($this->pages === []) {
            $this->label = 'Asset Accountability Form';
            $this->continuedLabel = '';
            $this->firstPageHeader();
            $this->text('No assets were selected.', self::LEFT, $this->y - 10, 9, false, self::MUTED);
            $this->closePage();
        }

        return $this->buildPdf();
    }

    private function employeeForm($user, $personal, $shared): void
    {
        $name = $this->clean($user->name ?? null);
        $this->label = $name === '' ? 'Employee' : $name;
        $this->continuedLabel = $this->label.' · continued';

        $this->firstPageHeader();
        $this->employeeInformation($user);
        $this->assetSection('Personal Accountability', $personal);
        $this->assetSection('Shared Accountability', $shared);
        $this->signoff();
        $this->closePage();
    }

    // ---------------------------------------------------------------- page chrome

    private function firstPageHeader(): void
    {
        $this->commands = [];
        [, $w, $h] = $this->logo;
        $height = 37.0;
        $width = $h > 0 ? $height * $w / $h : $height;
        $this->commands[] = sprintf('q %.2f 0 0 %.2f %.2f %.2f cm /Logo Do Q', $width, $height, (self::PAGE_WIDTH - $width) / 2, self::TOP - $height);
        $this->centered('The Cat Clinic', self::TOP - $height - 11, 8, false, self::LABEL);
        $this->centered('Asset Accountability Form', self::TOP - $height - 38, 15, true, self::BLUE);
        $this->y = self::TOP - $height - 56;
    }

    private function continuationPage(): void
    {
        $this->closePage();
        $this->commands = [];
        [, $w, $h] = $this->logo;
        $height = 25.0;
        $width = $h > 0 ? $height * $w / $h : $height;
        $this->commands[] = sprintf('q %.2f 0 0 %.2f %.2f %.2f cm /Logo Do Q', $width, $height, self::LEFT, self::TOP - $height);
        $textX = self::LEFT + $width + 9;
        $this->text('Asset Accountability Form', $textX, self::TOP - 10, 11, true, self::BLUE);
        $this->text($this->continuedLabel, $textX, self::TOP - 21, 8, false, self::MUTED);
        $this->line(self::LEFT, self::TOP - $height - 7, self::RIGHT, self::TOP - $height - 7, self::GRID, 0.7);
        $this->y = self::TOP - $height - 21;
    }

    private function closePage(): void
    {
        if ($this->commands === []) {
            return;
        }
        $this->pages[] = ['commands' => $this->commands, 'label' => $this->label];
        $this->commands = [];
    }

    private function employeeInformation($user): void
    {
        $this->heading('Employee Information');
        $rows = [
            'Name:' => $this->clean($user->name ?? null),
            'Department:' => $this->clean($user->department?->name ?? (is_string($user->department ?? null) ? $user->department : null)),
            'Branch:' => $this->clean($user->branches?->first()?->name ?? null),
            'Date:' => $this->generated,
        ];
        foreach ($rows as $label => $value) {
            $this->text($label, self::LEFT + 6, $this->y - 8, 9, true, self::LABEL);
            $this->text($value === '' ? '—' : $value, self::LEFT + 82, $this->y - 8, 9, false, self::INK);
            $this->y -= 16;
        }
        $this->y -= 4;
    }

    private function heading(string $title, bool $continued = false): void
    {
        $this->text($title, self::LEFT, $this->y - 10, 11, true, self::BLUE);
        if ($continued) {
            $this->text('(continued)', self::LEFT + $this->width($title, 11, true) + 5, $this->y - 10, 8, false, self::MUTED);
        }
        $this->y -= 19;
    }

    // ---------------------------------------------------------------- tables

    private function assetSection(string $title, $assets): void
    {
        $assets = collect($assets)->values();
        $widths = $this->columnWidths();
        $rows = $assets->map(fn ($asset) => [
            $this->clean($asset->name ?? null),
            $this->clean($asset->asset_tag ?? null),
            $this->serialModel($asset),
            $this->clean($asset->condition ?? null),
            $this->clean($asset->remarks ?? null),
        ])->all();

        $this->y -= 5;
        $first = $rows === [] ? 22.0 : $this->rowHeight($rows[0], $widths);
        // Heading + table header + first row must fit, otherwise the section starts on a fresh page.
        $this->ensureSpace(19 + 20 + $first);
        $this->heading($title);
        $this->tableHeader($widths);

        if ($rows === []) {
            $this->emptyRow();
        }

        foreach ($rows as $row) {
            $height = $this->rowHeight($row, $widths);
            if ($this->y - $height < self::BOTTOM) {
                $this->continuationPage();
                $this->heading($title, true);
                $this->tableHeader($widths);
            }
            $this->dataRow($row, $widths, $height);
        }
        $this->y -= 8;
    }

    private function columnWidths(): array
    {
        $total = self::RIGHT - self::LEFT;

        return array_map(fn ($share) => $total * $share, self::COLUMNS);
    }

    private function tableHeader(array $widths): void
    {
        $height = 20.0;
        $x = self::LEFT;
        foreach ($widths as $i => $width) {
            $this->fillRect($x, $this->y - $height, $width, $height, self::HEAD_FILL);
            $this->strokeRect($x, $this->y - $height, $width, $height, self::GRID, 0.6);
            $this->text(self::HEADERS[$i], $x + 4, $this->y - 13, 8.5, true, self::BLUE);
            $x += $width;
        }
        $this->y -= $height;
    }

    private function emptyRow(): void
    {
        $height = 22.0;
        $this->strokeRect(self::LEFT, $this->y - $height, self::RIGHT - self::LEFT, $height, self::GRID, 0.6);
        $this->text('No assets listed.', self::LEFT + 4, $this->y - 14, 8.5, false, self::FAINT);
        $this->y -= $height;
    }

    private function dataRow(array $row, array $widths, float $height): void
    {
        $x = self::LEFT;
        foreach ($widths as $i => $width) {
            $this->strokeRect($x, $this->y - $height, $width, $height, self::GRID, 0.6);
            $lines = $this->cellLines($row[$i], $i, $width);
            $block = count($lines) * 10.5;
            $baseline = $this->y - (($height - $block) / 2) - 8;
            foreach ($lines as $line) {
                if ($line !== '') {
                    $this->text($line, $x + 4, $baseline, $i === 1 ? 7.5 : 8.5, false, self::INK, $i === 1);
                }
                $baseline -= 10.5;
            }
            $x += $width;
        }
        $this->y -= $height;
    }

    private function rowHeight(array $row, array $widths): float
    {
        $max = 1;
        foreach ($widths as $i => $width) {
            $max = max($max, count($this->cellLines($row[$i], $i, $width)));
        }

        return max(22.0, $max * 10.5 + 10);
    }

    /** @return array<int, string> */
    private function cellLines(string $value, int $column, float $width): array
    {
        $maxWidth = $width - 8;
        if ($column === 1) {
            // Tags use Courier and must not wrap; range tags are common. Only break if truly oversized.
            return $this->wrapMono($value === '' ? '—' : $value, $maxWidth, 7.5);
        }

        return $this->wrap($value, $maxWidth, 8.5);
    }

    private function serialModel($asset): string
    {
        $serial = $this->clean($asset->serial_no ?? null);
        $model = $this->clean($asset->model_no ?? null);

        return ($serial === '' ? '—' : $serial).' / '.($model === '' ? '—' : $model);
    }

    // ---------------------------------------------------------------- sign-off

    private function signoff(): void
    {
        $lines = $this->wrap(self::ACKNOWLEDGMENT, self::RIGHT - self::LEFT, 9);
        $height = 19 + count($lines) * 15.5 + 78;
        $this->y -= 8;
        $this->ensureSpace($height);

        $this->heading('Acknowledgment');
        foreach ($lines as $line) {
            $this->text($line, self::LEFT, $this->y - 9, 9, false, self::INK);
            $this->y -= 15.5;
        }

        $this->y -= 46;
        $gap = 28.0;
        $column = (self::RIGHT - self::LEFT - $gap) / 2;
        foreach ([['Employee Signature', self::LEFT], ['IT Dept. Representative', self::LEFT + $column + $gap]] as [$label, $x]) {
            $this->line($x, $this->y, $x + $column, $this->y, [0.42, 0.478, 0.549], 0.8);
            $this->text($label, $x, $this->y - 11, 8.5, false, self::LABEL);
            $this->text('Date:', $x, $this->y - 33, 8.5, false, self::LABEL);
            $this->line($x + 28, $this->y - 33, $x + 28 + 110, $this->y - 33, [0.42, 0.478, 0.549], 0.8);
        }
        $this->y -= 44;
    }

    private function ensureSpace(float $needed): void
    {
        if ($this->y - $needed < self::BOTTOM) {
            $this->continuationPage();
        }
    }

    // ---------------------------------------------------------------- text helpers

    private function clean($value): string
    {
        return trim((string) ($value ?? ''));
    }

    private function toLatin(string $text): string
    {
        $text = preg_replace('/\s+/u', ' ', $text) ?? $text;

        return mb_convert_encoding($text, 'Windows-1252', 'UTF-8');
    }

    private function width(string $text, float $size, bool $bold = false, bool $mono = false): float
    {
        $latin = $this->toLatin($text);
        if ($mono) {
            return strlen($latin) * 0.6 * $size;
        }
        $sum = 0;
        for ($i = 0, $n = strlen($latin); $i < $n; $i++) {
            $code = ord($latin[$i]);
            $sum += ($code >= 32 && $code <= 126) ? self::HELVETICA[$code - 32] : 556;
        }

        return $sum / 1000 * $size * ($bold ? 1.07 : 1);
    }

    /** @return array<int, string> */
    private function wrap(string $text, float $maxWidth, float $size): array
    {
        $text = trim(preg_replace('/\s+/u', ' ', $text) ?? $text);
        if ($text === '') {
            return [''];
        }
        $lines = [];
        $line = '';
        foreach (explode(' ', $text) as $word) {
            while ($this->width($word, $size) > $maxWidth) {
                // Break an over-long word (serial numbers, URLs) by characters.
                if ($line !== '') {
                    $lines[] = $line;
                    $line = '';
                }
                $cut = mb_strlen($word);
                while ($cut > 1 && $this->width(mb_substr($word, 0, $cut), $size) > $maxWidth) {
                    $cut--;
                }
                $lines[] = mb_substr($word, 0, $cut);
                $word = mb_substr($word, $cut);
            }
            $candidate = $line === '' ? $word : $line.' '.$word;
            if ($line !== '' && $this->width($candidate, $size) > $maxWidth) {
                $lines[] = $line;
                $line = $word;
            } else {
                $line = $candidate;
            }
        }
        if ($line !== '') {
            $lines[] = $line;
        }

        return $lines;
    }

    /** @return array<int, string> */
    private function wrapMono(string $text, float $maxWidth, float $size): array
    {
        $perLine = max(1, (int) floor($maxWidth / (0.6 * $size)));

        return mb_str_split($text, $perLine) ?: [''];
    }

    private function centered(string $value, float $y, float $size, bool $bold, array $color): void
    {
        $this->text($value, (self::PAGE_WIDTH - $this->width($value, $size, $bold)) / 2, $y, $size, $bold, $color);
    }

    private function text(string $value, float $x, float $y, float $size, bool $bold = false, array $color = [0, 0, 0], bool $mono = false): void
    {
        $font = $mono ? '/F3' : ($bold ? '/F2' : '/F1');
        $this->commands[] = sprintf('%.3f %.3f %.3f rg', ...$color);
        $this->commands[] = sprintf('BT %s %.2f Tf 1 0 0 1 %.2f %.2f Tm (%s) Tj ET', $font, $size, $x, $y, $this->escape($value));
    }

    private function line(float $x1, float $y1, float $x2, float $y2, array $color, float $weight): void
    {
        $this->commands[] = sprintf('%.3f %.3f %.3f RG %.2f w %.2f %.2f m %.2f %.2f l S', ...array_merge($color, [$weight, $x1, $y1, $x2, $y2]));
    }

    private function strokeRect(float $x, float $y, float $width, float $height, array $color, float $weight): void
    {
        $this->commands[] = sprintf('%.3f %.3f %.3f RG %.2f w %.2f %.2f %.2f %.2f re S', ...array_merge($color, [$weight, $x, $y, $width, $height]));
    }

    private function fillRect(float $x, float $y, float $width, float $height, array $color): void
    {
        $this->commands[] = sprintf('%.3f %.3f %.3f rg %.2f %.2f %.2f %.2f re f', ...array_merge($color, [$x, $y, $width, $height]));
    }

    /** Encode as WinAnsi (Windows-1252) and escape for a PDF literal string. */
    private function escape(string $text): string
    {
        $latin = $this->toLatin($text);
        $out = '';
        for ($i = 0, $n = strlen($latin); $i < $n; $i++) {
            $code = ord($latin[$i]);
            if ($code === 40 || $code === 41 || $code === 92) {
                $out .= '\\'.$latin[$i];
            } elseif ($code < 32) {
                $out .= ' ';
            } elseif ($code > 126) {
                $out .= sprintf('\\%03o', $code);
            } else {
                $out .= $latin[$i];
            }
        }

        return $out;
    }

    // ---------------------------------------------------------------- PDF assembly

    private function buildPdf(): string
    {
        $total = count($this->pages);
        $fontRegular = 3 + ($total * 2);
        $fontBold = $fontRegular + 1;
        $fontMono = $fontRegular + 2;
        $logoObject = $fontRegular + 3;
        $objects = [1 => '<< /Type /Catalog /Pages 2 0 R >>'];
        $kids = [];

        foreach ($this->pages as $i => $page) {
            $pageObject = 3 + ($i * 2);
            $contentObject = $pageObject + 1;
            $kids[] = $pageObject.' 0 R';

            $this->commands = $page['commands'];
            $this->footer($page['label'], $i + 1, $total);
            $stream = "q\n".implode("\n", $this->commands)."\nQ\n";

            $objects[$pageObject] = sprintf('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.2f %.2f] /Resources << /Font << /F1 %d 0 R /F2 %d 0 R /F3 %d 0 R >> /XObject << /Logo %d 0 R >> >> /Contents %d 0 R >>', self::PAGE_WIDTH, self::PAGE_HEIGHT, $fontRegular, $fontBold, $fontMono, $logoObject, $contentObject);
            $objects[$contentObject] = '<< /Length '.strlen($stream).">>\nstream\n".$stream.'endstream';
        }

        $objects[2] = '<< /Type /Pages /Kids ['.implode(' ', $kids).'] /Count '.$total.' >>';
        $objects[$fontRegular] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
        $objects[$fontBold] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
        $objects[$fontMono] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>';
        [$jpeg, $w, $h] = $this->logo;
        $objects[$logoObject] = '<< /Type /XObject /Subtype /Image /Width '.$w.' /Height '.$h.' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '.strlen($jpeg).">>\nstream\n".$jpeg."\nendstream";
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
        for ($i = 1; $i < $size; $i++) {
            $pdf .= sprintf('%010d 00000 n ', $offsets[$i] ?? 0)."\n";
        }

        return $pdf."trailer\n<< /Size {$size} /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF";
    }

    private function footer(string $label, int $page, int $total): void
    {
        $this->line(self::LEFT, 38, self::RIGHT, 38, [0.89, 0.91, 0.93], 0.6);
        $this->text($label, self::LEFT, 27, 7, false, self::FAINT);
        $center = 'Page '.$page.' of '.$total;
        $this->text($center, (self::PAGE_WIDTH - $this->width($center, 7)) / 2, 27, 7, false, self::FAINT);
        $generated = 'Generated '.$this->generated;
        $this->text($generated, self::RIGHT - $this->width($generated, 7), 27, 7, false, self::FAINT);
    }
}

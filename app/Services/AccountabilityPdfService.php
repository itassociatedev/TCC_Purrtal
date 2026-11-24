<?php

namespace App\Services;

/**
 * Builds the staff accountability form using the project's existing, dependency-free PDF writer.
 * Coordinates use PDF points on US Letter pages (612 x 792).
 */
class AccountabilityPdfService
{
    private const PAGE_WIDTH = 612;

    private const PAGE_HEIGHT = 792;

    private const LEFT = 42;

    private const RIGHT = 570;

    private const BLUE = [0.12, 0.29, 0.42];

    private const TEAL = [0.12, 0.49, 0.52];

    private const LIGHT = [0.93, 0.96, 0.97];

    private const GRID = [0.79, 0.84, 0.86];

    private array $pages = [];

    private array $commands = [];

    private float $y = 0;

    private string $employeeName = '';

    public function render($user, $personalAssets, $sharedAssets): string
    {
        $this->pages = [];
        $this->commands = [];
        $this->employeeName = $this->clean($user->name ?? null);
        $this->startPage();
        $this->employeeInformation($user);

        $this->assetSection('Personal Accountability', $personalAssets);
        $this->assetSection('Shared Accountability', $sharedAssets);

        // Give the acknowledgment and signatures their own page so they never collide
        // with long asset tables or get stranded below the printable area.
        $this->newPage();
        $this->sectionHeading('Acknowledgment');
        $acknowledgment = 'I acknowledge that the above asset(s) are assigned to me and I am responsible for their safekeeping and proper use. I understand that I must report any loss, damage, or transfer of the asset(s) to the IT Department immediately. Upon separation from the company or reassignment, I will return the asset(s) in good condition, subject to final inspection.';
        $this->paragraph($acknowledgment, self::LEFT, 10, self::RIGHT - self::LEFT, 15, [0.17, 0.22, 0.25]);
        $this->y -= 28;
        $this->signatureField('Employee Signature', 'Date', 340);
        $this->signatureField('IT Department Representative', 'Date', 285);

        $this->finishPage();

        return $this->pdf($this->pages);
    }

    private function startPage(): void
    {
        $this->commands = [];
        $this->y = 742;
        $this->commands[] = 'q 24 0 0 24 42 733 cm /Logo Do Q';
        $this->text('ASSET MANAGEMENT  /  ACCOUNTABILITY', self::RIGHT - 205, $this->y, 7.5, true, [0.38, 0.45, 0.49]);
        $this->line(self::LEFT, $this->y - 9, self::RIGHT, $this->y - 9, self::TEAL, 1.4);
        $this->y -= 43;
        $this->centered('Asset Accountability Form', $this->y, 19, true, self::BLUE);
        $this->y -= 34;
    }

    private function newPage(): void
    {
        $this->finishPage();
        $this->commands = [];
        $this->y = 742;
        $this->commands[] = 'q 24 0 0 24 42 733 cm /Logo Do Q';
        $this->text('ASSET MANAGEMENT  /  ACCOUNTABILITY', self::RIGHT - 205, $this->y, 7.5, true, [0.38, 0.45, 0.49]);
        $this->line(self::LEFT, $this->y - 9, self::RIGHT, $this->y - 9, self::TEAL, 1.4);
        $this->y -= 43;
        $this->centered('Asset Accountability Form', $this->y, 19, true, self::BLUE);
        $this->y -= 34;
        $this->text('Employee: '.($this->employeeName === '' ? '—' : $this->employeeName), self::LEFT, $this->y, 8.5, false, [0.32, 0.39, 0.43]);
        $this->rightText('CONTINUED', self::RIGHT, $this->y, 7, true, self::TEAL);
        $this->y -= 19;
    }

    private function employeeInformation($user): void
    {
        $this->sectionHeading('Employee Information');
        $gap = 10;
        $col = (self::RIGHT - self::LEFT - $gap) / 2;
        $this->infoCell('EMPLOYEE NAME', $this->clean($user->name ?? null), self::LEFT, $this->y, $col);
        $this->infoCell('DEPARTMENT', $this->clean($user->department?->name ?? $user->department ?? null), self::LEFT + $col + $gap, $this->y, $col);
        $this->y -= 43;
        $this->infoCell('BRANCH', $this->clean($user->branches?->first()?->name ?? null), self::LEFT, $this->y, $col);
        $this->infoCell('DATE ISSUED', now()->format('F j, Y'), self::LEFT + $col + $gap, $this->y, $col);
        $this->y -= 47;
    }

    private function infoCell(string $label, string $value, float $x, float $top, float $width): void
    {
        $this->text($label, $x, $top, 6.8, true, [0.38, 0.45, 0.49], 0.7);
        $this->text($value === '' ? '—' : $value, $x, $top - 16, 10, true, [0.16, 0.21, 0.24]);
        $this->line($x, $top - 22, $x + $width, $top - 22, self::GRID, 0.6);
    }

    private function assetSection(string $title, $assets): void
    {
        $assets = collect($assets)->values();
        $this->ensureSpace(64);
        $this->sectionHeading($title);
        $widths = [112, 67, 118, 78, 153];
        $headers = ['ASSET ITEM', 'ASSET TAG', 'SERIAL / MODEL', 'CONDITION', 'REMARKS'];
        $this->tableHeader($widths, $headers);
        $rows = $assets->isEmpty()
            ? [['No assets assigned', '', '', '', '']]
            : $assets->map(fn ($asset) => [
                $this->clean($asset->name ?? null),
                $this->clean($asset->asset_tag ?? null),
                $this->clean(($asset->serial_no ?: null) ?: ($asset->model_no ?: null)),
                $this->clean($asset->condition ?? null),
                $this->clean($asset->remarks ?? null),
            ])->all();

        foreach ($rows as $row) {
            $wrapped = [];
            foreach ($row as $index => $value) {
                $wrapped[] = $this->wrap($value === '' ? '—' : $value, $widths[$index] - 12, 7.6);
            }
            $totalLines = max(1, ...array_map('count', $wrapped));
            $offset = 0;
            while ($offset < $totalLines) {
                // Split exceptionally long individual values across pages too; a single
                // asset must never be allowed to run into the footer or off the sheet.
                $lineCount = min(43, $totalLines - $offset);
                $height = max(27, $lineCount * 10 + 12);
                if ($this->y - $height < 76) {
                    $this->newPage();
                    $this->text($title.' (continued)', self::LEFT, $this->y, 9, true, self::BLUE);
                    $this->y -= 17;
                    $this->tableHeader($widths, $headers);
                }
                $x = self::LEFT;
                foreach ($widths as $i => $width) {
                    $this->fillRect($x, $this->y - $height, $width, $height, [1, 1, 1]);
                    $this->strokeRect($x, $this->y - $height, $width, $height, self::GRID, 0.55);
                    $lineY = $this->y - 13;
                    $cellLines = array_slice($wrapped[$i], $offset, $lineCount);
                    foreach ($cellLines as $line) {
                        $this->text($line, $x + 6, $lineY, 7.6, false, [0.16, 0.21, 0.24]);
                        $lineY -= 10;
                    }
                    $x += $width;
                }
                $this->y -= $height;
                $offset += $lineCount;
            }
        }
        $this->y -= 21;
    }

    private function sectionHeading(string $title): void
    {
        $this->text($title, self::LEFT, $this->y, 11, true, self::BLUE);
        $this->line(self::LEFT, $this->y - 5, self::LEFT + 28, $this->y - 5, self::TEAL, 1.8);
        $this->y -= 19;
    }

    private function tableHeader(array $widths, array $labels): void
    {
        $height = 26;
        $x = self::LEFT;
        foreach ($widths as $index => $width) {
            $this->fillRect($x, $this->y - $height, $width, $height, self::LIGHT);
            $this->strokeRect($x, $this->y - $height, $width, $height, self::GRID, 0.55);
            $this->text($labels[$index], $x + 6, $this->y - 16, 6.2, true, self::BLUE, 0.45);
            $x += $width;
        }
        $this->y -= $height;
    }

    private function paragraph(string $value, float $x, float $size, float $width, float $leading, array $color): void
    {
        foreach ($this->wrap($value, $width, $size) as $line) {
            $this->text($line, $x, $this->y, $size, false, $color);
            $this->y -= $leading;
        }
    }

    private function signatureField(string $label, string $dateLabel, float $width): void
    {
        $x = self::LEFT;
        $this->line($x, $this->y - 36, $x + $width, $this->y - 36, [0.32, 0.39, 0.43], 0.8);
        $this->text($label, $x, $this->y - 49, 8.2, true, self::BLUE);
        $this->text('SIGNATURE OVER PRINTED NAME', $x, $this->y - 61, 6.2, false, [0.48, 0.54, 0.57], 0.55);
        $dx = $x + $width + 20;
        $this->text($dateLabel, $dx, $this->y - 49, 8, true, self::BLUE);
        $this->line($dx, $this->y - 36, self::RIGHT, $this->y - 36, [0.32, 0.39, 0.43], 0.8);
        $this->text('DATE', $dx, $this->y - 61, 6.2, false, [0.48, 0.54, 0.57], 0.55);
        $this->y -= 95;
    }

    private function ensureSpace(float $needed): void
    {
        if ($this->y - $needed < 76) {
            $this->newPage();
        }
    }

    private function finishPage(): void
    {
        $pageNumber = count($this->pages) + 1;
        $this->line(self::LEFT, 38, self::RIGHT, 38, self::GRID, 0.6);
        $this->text('THE CAT CLINIC  •  ASSET ACCOUNTABILITY', self::LEFT, 24, 6.5, true, [0.47, 0.53, 0.56], 0.5);
        $this->rightText('PAGE '.$pageNumber, self::RIGHT, 24, 6.5, true, [0.47, 0.53, 0.56]);
        $this->pages[] = $this->commands;
    }

    private function wrap(string $text, float $width, float $size): array
    {
        // The built-in Helvetica fonts are single-byte; transliterate before measuring
        // so a UTF-8 character is never split between wrapped lines.
        $text = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text) ?: $text;
        $text = trim(preg_replace('/\s+/u', ' ', $text) ?? $text);
        if ($text === '') {
            return ['—'];
        }
        $max = max(1, (int) floor($width / ($size * 0.53)));
        $words = preg_split('/\s+/u', $text) ?: [$text];
        $lines = [];
        $line = '';
        foreach ($words as $word) {
            while (strlen($word) > $max) {
                if ($line !== '') {
                    $lines[] = $line;
                    $line = '';
                }
                $lines[] = substr($word, 0, $max);
                $word = substr($word, $max);
            }
            $candidate = $line === '' ? $word : $line.' '.$word;
            if (strlen($candidate) > $max && $line !== '') {
                $lines[] = $line;
                $line = $word;
            } else {
                $line = $candidate;
            }
        }
        if ($line !== '') {
            $lines[] = $line;
        }

        return $lines ?: ['—'];
    }

    private function clean($value): string
    {
        return trim((string) ($value ?? ''));
    }

    private function centered(string $value, float $y, float $size, bool $bold = false, array $color = [0, 0, 0]): void
    {
        $this->text($value, (self::PAGE_WIDTH - strlen($value) * $size * 0.52) / 2, $y, $size, $bold, $color);
    }

    private function rightText(string $value, float $right, float $y, float $size, bool $bold, array $color): void
    {
        $this->text($value, $right - strlen($value) * $size * 0.52, $y, $size, $bold, $color);
    }

    private function text(string $value, float $x, float $y, float $size, bool $bold = false, array $color = [0, 0, 0], float $spacing = 0): void
    {
        $value = $this->escape($value);
        $this->commands[] = sprintf('%.3f %.3f %.3f rg', ...$color);
        $this->commands[] = sprintf('BT %s %.2f Tf %.2f Tc 1 0 0 1 %.2f %.2f Tm (%s) Tj ET', $bold ? '/F2' : '/F1', $size, $spacing, $x, $y, $value);
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

    private function escape(string $text): string
    {
        $text = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text) ?: $text;

        return str_replace(['\\', '(', ')', "\r", "\n"], ['\\\\', '\\(', '\\)', ' ', ' '], $text);
    }

    private function pdf(array $pages): string
    {
        $count = count($pages);
        $fontRegular = 3 + ($count * 2);
        $fontBold = $fontRegular + 1;
        $logoObject = $fontBold + 1;
        $objects = [1 => '<< /Type /Catalog /Pages 2 0 R >>'];
        $logo = $this->logoJpeg();
        $kids = [];
        foreach ($pages as $i => $page) {
            $pageObject = 3 + ($i * 2);
            $contentObject = $pageObject + 1;
            $kids[] = $pageObject.' 0 R';
            $stream = "q\n".implode("\n", $page)."\nQ\n";
            $objects[$pageObject] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 '.$fontRegular.' 0 R /F2 '.$fontBold.' 0 R >> /XObject << /Logo '.$logoObject.' 0 R >> >> /Contents '.$contentObject.' 0 R >>';
            $objects[$contentObject] = '<< /Length '.strlen($stream).">>\nstream\n".$stream.'endstream';
        }
        $objects[2] = '<< /Type /Pages /Kids ['.implode(' ', $kids).'] /Count '.$count.' >>';
        $objects[$fontRegular] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
        $objects[$fontBold] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
        $objects[$logoObject] = '<< /Type /XObject /Subtype /Image /Width '.$logo[1].' /Height '.$logo[2].' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '.strlen($logo[0]).">>\nstream\n".$logo[0]."\nendstream";
        if (! is_file(resource_path('js/Assets/tcc_logo.png'))) {
            // Keep a valid, lightweight wordmark fallback if the optional artwork is unavailable.
            foreach ($pages as &$page) {
                $page[] = '0.120 0.490 0.520 rg BT /F2 9 Tf 1.2 Tc 1 0 0 1 42 742 Tm (THE CAT CLINIC) Tj ET';
            }
            unset($page);
        }
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

    /** @return array{string, int, int} JPEG bytes, width and height */
    private function logoJpeg(): array
    {
        $path = resource_path('js/Assets/tcc_logo.png');
        if (! extension_loaded('gd')) {
            return [base64_decode('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EAF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k=') ?: '', 1, 1];
        }
        $source = is_file($path) ? @imagecreatefrompng($path) : false;
        $width = $source ? imagesx($source) : 1;
        $height = $source ? imagesy($source) : 1;
        $flat = imagecreatetruecolor($width, $height);
        $white = imagecolorallocate($flat, 255, 255, 255);
        imagefill($flat, 0, 0, $white);
        if ($source) {
            imagecopy($flat, $source, 0, 0, 0, 0, $width, $height);
        }
        ob_start();
        imagejpeg($flat, null, 88);
        $jpeg = ob_get_clean();
        if ($source) {
            imagedestroy($source);
        }
        imagedestroy($flat);

        return [$jpeg === false ? '' : $jpeg, $width, $height];
    }
}

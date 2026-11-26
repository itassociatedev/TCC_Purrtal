<?php

namespace App\Services;

use Illuminate\Support\Collection;

/**
 * Creates A4 sheets containing compact asset stickers.
 * The QR area is intentionally left blank until the scanning workflow is finalized.
 */
class AssetStickerPdfService
{
    private const PAGE_WIDTH = 595;
    private const PAGE_HEIGHT = 842;
    // Keep a printer-safe outer margin while placing stickers edge-to-edge inside the sheet.
    private const MARGIN = 18;
    private const GAP = 0;
    private const COLUMNS = 3;
    private const ROWS = 11;
    private const LABEL_HEIGHT = (self::PAGE_HEIGHT - (self::MARGIN * 2)) / self::ROWS;

    private array $pages = [];
    private array $commands = [];

    public function render(Collection|array $assets): string
    {
        $this->pages = [];
        $this->commands = [];
        $assets = collect($assets)->values();

        foreach ($assets->chunk(self::COLUMNS * self::ROWS) as $pageAssets) {
            $this->startPage();
            foreach ($pageAssets->values() as $index => $asset) {
                $this->sticker($asset, $index);
            }
            $this->finishPage();
        }

        if ($this->pages === []) {
            $this->startPage();
            $this->finishPage();
        }

        return $this->pdf($this->pages);
    }

    private function startPage(): void
    {
        $this->commands = [];
    }

    private function finishPage(): void
    {
        $this->pages[] = $this->commands;
    }

    private function sticker($asset, int $index): void
    {
        $labelWidth = (self::PAGE_WIDTH - (self::MARGIN * 2) - self::GAP) / self::COLUMNS;
        $column = $index % self::COLUMNS;
        $row = intdiv($index, self::COLUMNS);
        $x = self::MARGIN + ($column * ($labelWidth + self::GAP));
        $top = self::MARGIN + ($row * (self::LABEL_HEIGHT + self::GAP));
        $y = self::PAGE_HEIGHT - $top - self::LABEL_HEIGHT;
        $footerHeight = self::LABEL_HEIGHT * 0.27;
        $contentTop = $y + self::LABEL_HEIGHT - 11;
        $textX = $x + 38;
        $artSize = self::LABEL_HEIGHT * 0.36;
        $qrSize = $artSize * 1.35;
        $qrX = $x + $labelWidth - $qrSize - 6;
        $textWidth = $qrX - $textX - 6;

        $this->fillRect($x, $y, $labelWidth, self::LABEL_HEIGHT, [1, 1, 1]);
        $this->strokeRect($x, $y, $labelWidth, self::LABEL_HEIGHT, [0.02, 0.02, 0.02], 1.2);
        $this->line($x, $y + $footerHeight, $x + $labelWidth, $y + $footerHeight, [0.02, 0.02, 0.02], 1.2);

        $artX = $x + (($textX - $x - $artSize) / 2);
        $artY = $y + $footerHeight + ((self::LABEL_HEIGHT - $footerHeight - $artSize) / 2);
        $this->image('Cat', $artX, $artY, $artSize, $artSize);

        $name = $this->clean($asset->name ?? null) ?: 'Unnamed Asset';
        $tag = $this->clean($asset->asset_tag ?? null) ?: 'No Asset Tag';
        $nameLabelWidth = 57;
        $nameLines = $this->wrapInline($name, $textWidth - $nameLabelWidth, $textWidth, 7.6);
        $this->text('ASSET NAME:', $textX, $contentTop, 7.6, true, [0.02, 0.02, 0.02]);
        $this->text($nameLines[0] ?? '', $textX + $nameLabelWidth, $contentTop, 7.6, false, [0.02, 0.02, 0.02]);
        $nameY = $contentTop - 8;
        foreach (array_slice($nameLines, 1, 3) as $line) {
            $this->text($line, $textX, $nameY, 7.6, false, [0.02, 0.02, 0.02]);
            $nameY -= 8;
        }

        $tagY = $y + $footerHeight + 7;
        $this->text('ASSET TAG:', $textX, $tagY, 7.3, true, [0.02, 0.02, 0.02]);
        $tagValueX = $textX + 51;
        $tagTextWidth = max(1, $qrX - $tagValueX - 6);
        $tagFontSize = min(7.3, $tagTextWidth / (max(1, strlen($tag)) * 0.58));
        $this->text($tag, $tagValueX, $tagY, $tagFontSize, false, [0.02, 0.02, 0.02]);

        $qrY = $y + $footerHeight + ((self::LABEL_HEIGHT - $footerHeight - $qrSize) / 2);
        $this->fillRect($qrX, $qrY, $qrSize, $qrSize, [1, 1, 1]);
        $this->strokeRect($qrX, $qrY, $qrSize, $qrSize, [0.02, 0.02, 0.02], 0.8);

        $this->centerText('PROPERTY OF THE CAT CLINIC', $x + ($labelWidth / 2), $y + 6, 8.3, true, [0.02, 0.02, 0.02]);
    }

    private function image(string $name, float $x, float $y, float $width, float $height): void
    {
        $this->commands[] = sprintf('q %.2f 0 0 %.2f %.2f %.2f cm /%s Do Q', $width, $height, $x, $y, $name);
    }

    private function text(string $value, float $x, float $y, float $size, bool $bold = false, array $color = [0, 0, 0]): void
    {
        $font = $bold ? '/F2' : '/F1';
        $this->commands[] = sprintf('%.3f %.3f %.3f rg BT %s %.2f Tf 1 0 0 1 %.2f %.2f Tm (%s) Tj ET', ...array_merge($color, [$font, $size, $x, $y, $this->escape($value)]));
    }

    private function centerText(string $value, float $centerX, float $y, float $size, bool $bold, array $color): void
    {
        $width = strlen($value) * $size * 0.54;
        $this->text($value, $centerX - ($width / 2), $y, $size, $bold, $color);
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

    private function wrap(string $value, float $width, float $size): array
    {
        $limit = max(1, (int) floor($width / ($size * 0.52)));
        $words = preg_split('/\s+/', trim($value)) ?: [];
        $lines = [];
        $line = '';
        foreach ($words as $word) {
            $candidate = $line === '' ? $word : $line . ' ' . $word;
            if (strlen($candidate) > $limit && $line !== '') {
                $lines[] = $line;
                $line = $word;
            } else {
                $line = $candidate;
            }
        }
        if ($line !== '') $lines[] = $line;
        return $lines ?: [''];
    }

    private function wrapInline(string $value, float $firstLineWidth, float $continuationWidth, float $size): array
    {
        $words = preg_split('/\s+/', trim($value)) ?: [];
        $lines = [];
        $line = '';
        $width = $firstLineWidth;

        foreach ($words as $word) {
            $limit = max(1, (int) floor($width / ($size * 0.52)));
            $candidate = $line === '' ? $word : $line . ' ' . $word;
            if (strlen($candidate) > $limit && $line !== '') {
                $lines[] = $line;
                $line = $word;
                $width = $continuationWidth;
            } else {
                $line = $candidate;
            }
        }

        if ($line !== '') $lines[] = $line;

        return $lines ?: [''];
    }

    private function clean($value): string
    {
        return trim((string) ($value ?? ''));
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
        $catImage = $this->stickerCatJpeg();
        $objects = [1 => '<< /Type /Catalog /Pages 2 0 R >>'];
        $kids = [];

        foreach ($pages as $index => $page) {
            $pageObject = 3 + ($index * 2);
            $contentObject = $pageObject + 1;
            $kids[] = $pageObject . ' 0 R';
            $stream = "q\n" . implode("\n", $page) . "\nQ\n";
            $objects[$pageObject] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ' . $fontRegular . ' 0 R /F2 ' . $fontBold . ' 0 R >> /XObject << /Cat ' . $logoObject . ' 0 R >> >> /Contents ' . $contentObject . ' 0 R >>';
            $objects[$contentObject] = '<< /Length ' . strlen($stream) . ">>\nstream\n" . $stream . 'endstream';
        }

        $objects[2] = '<< /Type /Pages /Kids [' . implode(' ', $kids) . '] /Count ' . $count . ' >>';
        $objects[$fontRegular] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
        $objects[$fontBold] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
        $objects[$logoObject] = '<< /Type /XObject /Subtype /Image /Width ' . $catImage[1] . ' /Height ' . $catImage[2] . ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' . strlen($catImage[0]) . ">>\nstream\n" . $catImage[0] . "\nendstream";

        ksort($objects);
        $pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
        $offsets = [0];
        foreach ($objects as $number => $object) {
            $offsets[$number] = strlen($pdf);
            $pdf .= $number . " 0 obj\n" . $object . "\nendobj\n";
        }
        $xref = strlen($pdf);
        $size = max(array_keys($objects)) + 1;
        $pdf .= "xref\n0 {$size}\n0000000000 65535 f \n";
        for ($i = 1; $i < $size; $i++) $pdf .= sprintf('%010d 00000 n ', $offsets[$i] ?? 0) . "\n";
        return $pdf . "trailer\n<< /Size {$size} /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF";
    }

    /** @return array{string, int, int} */
    private function stickerCatJpeg(): array
    {
        $path = resource_path('js/Assets/kiki_asset_sticker.png');
        if (!extension_loaded('gd') || !is_file($path)) {
            return [base64_decode('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//9k=') ?: '', 1, 1];
        }
        $source = @imagecreatefrompng($path);
        if (!$source) return ['', 1, 1];
        $width = imagesx($source);
        $height = imagesy($source);
        $flat = imagecreatetruecolor($width, $height);
        $background = imagecolorallocate($flat, 255, 255, 255);
        imagefill($flat, 0, 0, $background);
        imagealphablending($flat, true);
        imagecopy($flat, $source, 0, 0, 0, 0, $width, $height);
        ob_start();
        imagejpeg($flat, null, 88);
        $jpeg = ob_get_clean() ?: '';
        imagedestroy($flat);
        imagedestroy($source);
        return [$jpeg, $width, $height];
    }
}

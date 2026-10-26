<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ImageOptimizer
{
    // Images larger than this (in pixels) are stored as-is to stay within PHP's memory limit
    private const MAX_PIXELS = 16_000_000;

    /**
     * Store an uploaded image on the public disk as a resized WebP (max $maxWidth wide).
     * The untouched upload is kept under "{$directory}/originals". Whenever the server
     * cannot convert safely, the upload is stored exactly as before.
     */
    public static function store(UploadedFile $file, string $directory, int $maxWidth = 1920, int $quality = 85): string
    {
        $mime = $file->getMimeType();
        $converters = [
            'image/jpeg' => 'imagecreatefromjpeg',
            'image/png' => 'imagecreatefrompng',
            'image/webp' => 'imagecreatefromwebp',
        ];

        if (!function_exists('imagewebp') || !isset($converters[$mime]) || !function_exists($converters[$mime])) {
            return $file->store($directory, 'public');
        }

        // Phone photos rely on EXIF orientation; without the exif extension we cannot keep it
        if ($mime === 'image/jpeg' && !function_exists('exif_read_data')) {
            return $file->store($directory, 'public');
        }

        $size = @getimagesize($file->getRealPath());
        if (!$size || $size[0] * $size[1] > self::MAX_PIXELS) {
            return $file->store($directory, 'public');
        }

        try {
            $image = $converters[$mime]($file->getRealPath());
            if (!$image) {
                return $file->store($directory, 'public');
            }

            if ($mime === 'image/jpeg') {
                $image = self::applyExifOrientation($image, $file->getRealPath());
            }

            $width = imagesx($image);
            $height = imagesy($image);

            if ($width > $maxWidth) {
                $newHeight = (int) round($height * $maxWidth / $width);
                $resized = imagecreatetruecolor($maxWidth, $newHeight);
                imagealphablending($resized, false);
                imagesavealpha($resized, true);
                imagecopyresampled($resized, $image, 0, 0, 0, 0, $maxWidth, $newHeight, $width, $height);
                imagedestroy($image);
                $image = $resized;
            } else {
                imagepalettetotruecolor($image);
                imagealphablending($image, false);
                imagesavealpha($image, true);
            }

            ob_start();
            $encoded = imagewebp($image, null, $quality);
            $data = ob_get_clean();
            imagedestroy($image);

            if (!$encoded || !$data) {
                return $file->store($directory, 'public');
            }

            $name = Str::random(40);
            $path = "{$directory}/{$name}.webp";
            Storage::disk('public')->put($path, $data);

            // Only use the WebP when it is actually smaller than the upload
            if (strlen($data) >= $file->getSize()) {
                Storage::disk('public')->delete($path);
                return $file->store($directory, 'public');
            }

            $file->storeAs("{$directory}/originals", $name . '.' . $file->extension(), 'public');

            return $path;
        } catch (\Throwable $e) {
            Log::warning('Image optimization failed, storing original upload: ' . $e->getMessage());
            return $file->store($directory, 'public');
        }
    }

    /**
     * Delete a stored image together with its kept original, if any.
     */
    public static function delete(?string $path): void
    {
        if (!$path) {
            return;
        }

        $disk = Storage::disk('public');
        $disk->delete($path);

        $originals = dirname($path) . '/originals/' . pathinfo($path, PATHINFO_FILENAME) . '.*';
        foreach (glob($disk->path($originals)) ?: [] as $original) {
            @unlink($original);
        }
    }

    private static function applyExifOrientation($image, string $filePath)
    {
        $exif = @exif_read_data($filePath);
        $angle = match ((int) ($exif['Orientation'] ?? 1)) {
            3 => 180,
            6 => -90,
            8 => 90,
            default => 0,
        };

        if ($angle === 0) {
            return $image;
        }

        $rotated = imagerotate($image, $angle, 0);
        imagedestroy($image);

        return $rotated;
    }
}

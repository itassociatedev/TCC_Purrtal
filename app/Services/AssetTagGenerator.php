<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\AssetPhotoSubmission;

/**
 * Builds the next branch-based asset tag (for example GH-00378).
 *
 * Existing tags are not all simple: some are ranges for a batch of items
 * (GH-00004-00022, GH-00206-208, GH-00212-14). The highest number covered by any
 * tag for the branch is used, so a generated tag never lands inside a range.
 */
class AssetTagGenerator
{
    public const BRANCH_NAMES = ['greenhills' => 'GH', 'makati' => 'MKT', 'alabang' => 'ALB'];

    /** Branch name or code (as stored in assets.branch) to a tag prefix, or null if unknown. */
    public static function codeForBranch(?string $branch): ?string
    {
        $branch = trim((string) $branch);
        if ($branch === '') {
            return null;
        }
        if (str_starts_with($branch, '{')) {
            $decoded = json_decode($branch, true);
            $branch = (string) ($decoded['code'] ?? $decoded['name'] ?? '');
        }

        $normalized = strtolower((string) preg_replace('/[^a-z0-9]/i', '', $branch));
        foreach (self::BRANCH_NAMES as $name => $code) {
            if ($normalized === $name || $normalized === strtolower($code)) {
                return $code;
            }
        }

        return null;
    }

    /** Highest tag number in use for a branch code (saved assets and new assets still waiting for photo approval). */
    public function highest(string $code): int
    {
        $tags = Asset::where('asset_tag', 'like', $code.'-%')->pluck('asset_tag')->all();

        $pending = AssetPhotoSubmission::where('submission_type', 'new_asset')
            ->where('status', 'pending')
            ->get()
            ->map(fn ($submission) => $submission->asset_data['asset_tag'] ?? null)
            ->filter()
            ->all();

        $highest = 0;
        foreach (array_merge($tags, $pending) as $tag) {
            $highest = max($highest, self::highestNumber($code, (string) $tag));
        }

        return $highest;
    }

    /** Next free tag for a branch code, counting saved assets and new assets still waiting for photo approval. */
    public function next(string $code): string
    {
        return self::format($code, $this->highest($code) + 1);
    }

    /** The next $count consecutive tags for a branch code (GH-00456, GH-00457, ...). */
    public function nextMany(string $code, int $count): array
    {
        $highest = $this->highest($code);

        return array_map(fn (int $i) => self::format($code, $highest + $i), range(1, max(1, $count)));
    }

    public static function format(string $code, int $number): string
    {
        return sprintf('%s-%05d', strtoupper($code), $number);
    }

    /**
     * Individual tags for a range tag: GH-00004-00022 gives GH-00004 ... GH-00022 (abbreviated ends such as
     * GH-00206-208 work too). Returns an empty array when the tag is not a range.
     *
     * @return array<int, string>
     */
    public static function expandRange(string $tag): array
    {
        if (! preg_match('/^([A-Za-z]+)-(\d+)-(\d+)$/', trim($tag), $match)) {
            return [];
        }
        $end = self::highestNumber($match[1], trim($tag));
        $start = (int) $match[2];
        if ($end <= $start || $end - $start >= 500) {
            return [];
        }

        $width = strlen($match[2]);

        return array_map(fn (int $n) => strtoupper($match[1]).'-'.str_pad((string) $n, $width, '0', STR_PAD_LEFT), range($start, $end));
    }

    public static function nextFromTags(string $code, iterable $tags): string
    {
        $highest = 0;
        foreach ($tags as $tag) {
            $highest = max($highest, self::highestNumber($code, (string) $tag));
        }

        return sprintf('%s-%05d', strtoupper($code), $highest + 1);
    }

    /**
     * Highest number a tag covers for the given prefix, or 0 if the tag does not
     * follow the PREFIX-NUMBER or PREFIX-START-END pattern.
     */
    public static function highestNumber(string $code, string $tag): int
    {
        if (! preg_match('/^'.preg_quote($code, '/').'-(\d+)(?:-(\d+))?$/i', trim($tag), $match)) {
            return 0;
        }

        $start = (int) $match[1];
        if (! isset($match[2])) {
            return $start;
        }

        // An abbreviated end keeps the leading digits of the start: 00212-14 is 214.
        $endDigits = $match[2];
        $fullEnd = strlen($endDigits) < strlen($match[1])
            ? substr($match[1], 0, strlen($match[1]) - strlen($endDigits)).$endDigits
            : $endDigits;
        $end = (int) $fullEnd;

        // Tags like ALB-2022-000042 are not ranges (the end is lower than the start).
        return $end >= $start ? $end : 0;
    }

    /** A tag made safe to use as a file name. */
    public static function fileSafe(string $tag): string
    {
        $safe = trim((string) preg_replace('/[^A-Za-z0-9._-]+/', '-', trim($tag)), '-.');

        return $safe;
    }
}

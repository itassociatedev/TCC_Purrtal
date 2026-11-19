<?php
namespace App\Support;
final class ImportFeedback
{
    public static function message(\Throwable $error): string
    {
        if ($error instanceof \Maatwebsite\Excel\Validators\ValidationException) {
            return implode("\n", array_map(fn ($failure) => 'Row '.$failure->row().', '.str_replace('_', ' ', $failure->attribute()).': '.implode(' ', $failure->errors()), $error->failures()));
        }
        if ($error instanceof \Illuminate\Validation\ValidationException) return implode("\n", array_merge(...array_values($error->errors())));
        return 'The workbook could not be imported. Use the latest XLSX template and check the file is not encrypted.';
    }
}

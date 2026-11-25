<?php

namespace Tests\Feature;

use PhpOffice\PhpSpreadsheet\Reader\Html;
use Tests\TestCase;

class DutyMealVerticalExportTest extends TestCase
{
    public function test_dates_run_down_rows_with_preserved_totals_and_notes(): void
    {
        $category=['total'=>3,'main'=>2,'alt'=>0,'special'=>1,'notes'=>['Staff: Fish &amp; rice']];
        $day=array_fill_keys(['clinic_lunch','clinic_dinner','clinic_whole','back_office'],$category);
        $html=view('exports.duty_meals',['weeks'=>['week'=>['days'=>['2026-10-26'=>$day,'2026-10-27'=>$day]]]])->render();
        $sheet=(new Html)->loadFromString($html)->getActiveSheet();
        $this->assertSame('G',$sheet->getHighestColumn());
        $this->assertSame('Date',$sheet->getCell('A2')->getValue());
        $this->assertSame('2026-10-26',$sheet->getCell('A3')->getValue());
        $this->assertSame('2026-10-27',$sheet->getCell('A7')->getValue());
        $this->assertSame(3,$sheet->getCell('C3')->getValue());
        $this->assertSame('Staff: Fish & rice',$sheet->getCell('G3')->getValue());
    }
}

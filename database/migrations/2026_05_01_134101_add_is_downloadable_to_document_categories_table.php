<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_categories', function (Blueprint $table) {
            // New categories are downloadable by default
          if(!Schema::hasColumn('document_categories', 'is_downloadable')) {
              $table->boolean('is_downloadable')->default(true)->after('name');
          }
        });
    }

    public function down(): void
    {
        Schema::table('document_categories', function (Blueprint $table) {
           if(Schema::hasColumn('document_categories', 'is_downloadable')) {
               $table->dropColumn('is_downloadable');
           }
        });
    }
};
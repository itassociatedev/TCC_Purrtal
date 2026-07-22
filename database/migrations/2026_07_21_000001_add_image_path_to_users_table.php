<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        if (!Schema::hasColumn('users', 'image_path')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('image_path')->nullable()->after('email')->comment('Profile image path stored in public disk');
            });
        }
    }

    public function down()
    {
        if (Schema::hasColumn('users', 'image_path')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('image_path');
            });
        }
    }
};

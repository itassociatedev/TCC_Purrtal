<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Comment;
use App\Models\Announcement;

class CommentController extends Controller
{
    public function store(Request $request, Announcement $announcement)
    {
        $user = auth()->user();

        // 1. Block banned users
        if ($user->is_comment_banned) {
            return back()->with('error', 'You are banned from commenting.');
        }

        // 2. Validate input
        $validated = $request->validate([
            'content' => 'required|string|max:1000'
        ]);

        // 3. Profanity Filter
        $badWords = ['badword1', 'inappropriate', 'stupid', 'nigga', 'fuck', 'penis', 'vagina', 'curse', 'tangina', 'taena', 'bobo', 'jerk', 'bitch', 'ass', 'gago', 'namo', 'bastard']; // Add your banned words here
        $commentText = strtolower($validated['content']);
        $containsBadWord = false;

        foreach ($badWords as $word) {
            if (str_contains($commentText, strtolower($word))) {
                $containsBadWord = true;
                break;
            }
        }

        // 4. Ban user if they curse
        if ($containsBadWord) {
            $user->update(['is_comment_banned' => true]);
            return back()->with('error', 'Your account has been restricted due to inappropriate language.');
        }

        // 5. Save the comment
        Comment::create([
            'user_id' => $user->id,
            'announcement_id' => $announcement->id,
            'content' => $validated['content']
        ]);

        return back()->with('success', 'Comment posted!');
    }

    public function destroy(\App\Models\Comment $comment)
    {
        // Security check: Only allow the author (or an admin) to delete the comment
        if ($comment->user_id !== auth()->id() && auth()->user()->role->name !== 'Admin') {
            abort(403, 'Unauthorized action.');
        }

        $comment->delete();

        return back();
    }
}
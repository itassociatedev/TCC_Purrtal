// Announcement comments UI component (post/delete comments)
import React from 'react';
import { useForm, usePage, router } from '@inertiajs/react';
import { canEditModule } from '@/Config/navigation';
import PrimaryButton from './PrimaryButton';
import TextInput from './TextInput';
import InputError from './InputError';

export default function AnnouncementComments({ announcement }) {
    const { auth, announcements } = usePage().props;
    // Allow any authenticated, non-banned user to post comments on announcements
    const canPostComments = !!auth?.user && !auth.user.is_comment_banned;

    const announcementList = Array.isArray(announcements?.data) 
        ? announcements.data 
        : (Array.isArray(announcements) ? announcements : []);
        
    const liveAnnouncement = announcementList.find(a => a.id === announcement.id) || announcement;
    const comments = liveAnnouncement.comments || []; 
    
    const { data, setData, post, processing, errors, reset } = useForm({
        content: '',
    });

    const submit = (e) => {
        e.preventDefault();
        post(route('announcements.comments.store', announcement.id), {
            preserveScroll: true,
            onSuccess: () => reset('content'),
        });
    };

    const deleteComment = (commentId) => {
        if (confirm('Are you sure you want to delete this comment?')) {
            router.delete(route('comments.destroy', commentId), {
                preserveScroll: true,
            });
        }
    };

    return (
        <div className="mt-6 border-t pt-4">
            <h3 className="text-lg font-bold mb-4 text-gray-800">Comments</h3>

            <div className="space-y-4 mb-4 max-h-64 overflow-y-auto pr-2">
                {comments.length === 0 ? (
                    <p className="text-gray-500 text-sm italic text-center py-4">No comments yet. Be the first to comment!</p>
                ) : (
                    comments.map((comment) => (
                        <div key={comment.id} className="flex flex-col items-start relative group w-full">
                            <div className="flex items-start gap-2 max-w-full w-full">
                                
                                {/* 🔥 FIXED: The Comment Bubble */}
                                <div className="h-10 w-10 shrink-0 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-900">
                                    {comment.user?.image_path ? (
                                        <img src={`/storage/${comment.user.image_path}`} alt={comment.user?.name || 'User'} className="h-full w-full object-cover" />
                                    ) : (
                                        <span>{(comment.user?.name || 'U').charAt(0)}</span>
                                    )}
                                </div>

                                <div className="bg-gray-100 px-4 py-2.5 rounded-2xl max-w-[85%] flex flex-col min-w-0">
                                    <span className="font-bold text-sm text-gray-900 leading-tight">
                                        {comment.user?.name || 'Unknown User'}
                                    </span>
                                    <span className="text-gray-800 text-sm mt-0.5 break-words whitespace-pre-wrap">
                                        {comment.content}
                                    </span>
                                </div>

                                {/* The Delete Button */}
                                {auth.user.id === comment.user_id && (
                                    <button
                                        onClick={() => deleteComment(comment.id)}
                                        className="text-xs font-bold text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                        title="Delete Comment"
                                    >
                                        Delete
                                    </button>
                                )}
                                
                            </div>
                        </div>
                    ))
                )}
            </div>

            {auth.user.is_comment_banned ? (
                <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm border font-bold text-center">
                    You have been restricted from commenting due to inappropriate language.
                </div>
            ) : canPostComments ? (
                <form onSubmit={submit} className="flex gap-2 items-start mt-2">
                    <div className="h-10 w-10 shrink-0 rounded-full overflow-hidden bg-indigo-600 flex items-center justify-center text-white font-bold uppercase">
                        {auth.user.image_path ? (
                            <img src={`/storage/${auth.user.image_path}`} alt={auth.user.name} className="h-full w-full object-cover" />
                        ) : (
                            <span className="inline-block w-full text-center">{auth.user.name.charAt(0)}</span>
                        )}
                    </div>
                    
                    <div className="flex-1">
                        <TextInput
                            type="text"
                            className="w-full rounded-full bg-gray-50 border-gray-300 focus:bg-white"
                            placeholder="Write a comment..."
                            value={data.content}
                            onChange={(e) => setData('content', e.target.value)}
                            autoComplete="off"
                        />
                        <InputError message={errors.content} className="mt-1 ml-2" />
                    </div>
                    <PrimaryButton 
                        disabled={processing || !data.content} 
                        className="rounded-full h-10 px-6"
                    >
                        Post
                    </PrimaryButton>
                </form>
            ) : (
                <div className="p-3 bg-gray-100 text-gray-700 rounded-md text-sm border text-center italic">
                    You need edit permission to post comments on announcements.
                </div>
            )}
        </div>
    );
}
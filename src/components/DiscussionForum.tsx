import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  updateDoc, 
  doc, 
  arrayUnion, 
  arrayRemove,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  MessageSquare, 
  Send, 
  ThumbsUp, 
  Reply, 
  MoreVertical, 
  Trash2, 
  Loader2,
  User as UserIcon
} from 'lucide-react';
import { Button } from './ui/Button';
import { motion, AnimatePresence } from 'motion/react';

interface ForumPost {
  id: string;
  courseId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: any;
  parentId?: string;
  likes?: string[];
}

interface DiscussionForumProps {
  courseId: string;
}

export const DiscussionForum: React.FC<DiscussionForumProps> = ({ courseId }) => {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [newPost, setNewPost] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'forumPosts'),
      where('courseId', '==', courseId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ForumPost[];
      setPosts(postsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [courseId]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newPost.trim() || submitting) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'forumPosts'), {
        courseId,
        userId: user.uid,
        userName: user.displayName || user.email,
        content: newPost.trim(),
        createdAt: serverTimestamp(),
        likes: []
      });
      setNewPost('');
    } catch (error) {
      console.error("Error adding post:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (parentId: string) => {
    if (!user || !replyContent.trim() || submitting) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'forumPosts'), {
        courseId,
        userId: user.uid,
        userName: user.displayName || user.email,
        content: replyContent.trim(),
        createdAt: serverTimestamp(),
        parentId,
        likes: []
      });
      setReplyContent('');
      setReplyingTo(null);
    } catch (error) {
      console.error("Error adding reply:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (postId: string, isLiked: boolean) => {
    if (!user) return;
    const postRef = doc(db, 'forumPosts', postId);
    try {
      await updateDoc(postRef, {
        likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
      });
    } catch (error) {
      console.error("Error liking post:", error);
    }
  };

  const handleDelete = async (postId: string) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      await deleteDoc(doc(db, 'forumPosts', postId));
    } catch (error) {
      console.error("Error deleting post:", error);
    }
  };

  const rootPosts = posts.filter(p => !p.parentId);
  const getReplies = (parentId: string) => posts.filter(p => p.parentId === parentId).reverse();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-900" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* New Post Form */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-900" />
          Start a Discussion
        </h3>
        <form onSubmit={handlePost} className="space-y-4">
          <textarea
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            placeholder="What's on your mind? Ask a question or share a thought..."
            className="w-full p-4 rounded-2xl border border-slate-200 focus:border-blue-900 focus:ring-1 focus:ring-blue-900 outline-none transition-all min-h-[120px] resize-none"
          />
          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={!newPost.trim() || submitting}
              className="rounded-full px-8"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Post Discussion
            </Button>
          </div>
        </form>
      </div>

      {/* Posts List */}
      <div className="space-y-6">
        {rootPosts.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No discussions yet. Be the first to start one!</p>
          </div>
        ) : (
          rootPosts.map(post => (
            <div key={post.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-900">
                      <UserIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{post.userName}</p>
                      <p className="text-xs text-slate-400">
                        {post.createdAt?.toDate().toLocaleDateString()} at {post.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  {(user?.uid === post.userId || profile?.role === 'ADMIN') && (
                    <button 
                      onClick={() => handleDelete(post.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors p-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-slate-700 leading-relaxed mb-6 whitespace-pre-wrap">
                  {post.content}
                </p>
                <div className="flex items-center gap-6">
                  <button 
                    onClick={() => handleLike(post.id, post.likes?.includes(user?.uid || '') || false)}
                    className={`flex items-center gap-2 text-sm font-bold transition-colors ${
                      post.likes?.includes(user?.uid || '') ? 'text-blue-900' : 'text-slate-400 hover:text-blue-900'
                    }`}
                  >
                    <ThumbsUp className={`w-4 h-4 ${post.likes?.includes(user?.uid || '') ? 'fill-current' : ''}`} />
                    {post.likes?.length || 0}
                  </button>
                  <button 
                    onClick={() => setReplyingTo(replyingTo === post.id ? null : post.id)}
                    className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-blue-900 transition-colors"
                  >
                    <Reply className="w-4 h-4" />
                    Reply
                  </button>
                </div>
              </div>

              {/* Replies Section */}
              <div className="bg-slate-50/50 border-t border-slate-50">
                <div className="p-6 space-y-6">
                  {getReplies(post.id).map(reply => (
                    <div key={reply.id} className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                        <UserIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-bold text-slate-900">{reply.userName}</p>
                          {(user?.uid === reply.userId || profile?.role === 'ADMIN') && (
                            <button 
                              onClick={() => handleDelete(reply.id)}
                              className="text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 mb-2 whitespace-pre-wrap">{reply.content}</p>
                        <div className="flex items-center gap-4">
                          <button 
                            onClick={() => handleLike(reply.id, reply.likes?.includes(user?.uid || '') || false)}
                            className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${
                              reply.likes?.includes(user?.uid || '') ? 'text-blue-900' : 'text-slate-400 hover:text-blue-900'
                            }`}
                          >
                            <ThumbsUp className={`w-3 h-3 ${reply.likes?.includes(user?.uid || '') ? 'fill-current' : ''}`} />
                            {reply.likes?.length || 0}
                          </button>
                          <span className="text-[10px] text-slate-300">
                            {reply.createdAt?.toDate().toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Reply Input */}
                  <AnimatePresence>
                    {replyingTo === post.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-4 flex gap-4">
                          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-900 shrink-0">
                            <UserIcon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 space-y-3">
                            <textarea
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                              placeholder="Write a reply..."
                              className="w-full p-3 rounded-xl border border-slate-200 focus:border-blue-900 focus:ring-1 focus:ring-blue-900 outline-none transition-all min-h-[80px] text-sm resize-none"
                            />
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setReplyingTo(null)}
                                className="rounded-full"
                              >
                                Cancel
                              </Button>
                              <Button 
                                size="sm" 
                                disabled={!replyContent.trim() || submitting}
                                onClick={() => handleReply(post.id)}
                                className="rounded-full"
                              >
                                {submitting ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Send className="w-3 h-3 mr-2" />}
                                Reply
                              </Button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

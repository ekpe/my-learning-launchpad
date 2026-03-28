import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { courses } from '../data/courses';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  ArrowLeft,
  Trophy,
  RefreshCw,
  LayoutDashboard
} from 'lucide-react';
import { Button } from './ui/Button';
import { motion, AnimatePresence } from 'motion/react';
import { Course } from '../types';

export const QuizViewer = () => {
  const { courseId, moduleIndex } = useParams<{ courseId: string; moduleIndex: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [quizAttempt, setQuizAttempt] = useState<any>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [course, setCourse] = useState<Course | undefined>(courses.find(c => c.id === courseId));

  useEffect(() => {
    if (!courseId) return;

    const unsubscribe = onSnapshot(doc(db, 'courses', courseId), (docSnap) => {
      if (docSnap.exists()) {
        setCourse(docSnap.data() as Course);
      }
    });

    return () => unsubscribe();
  }, [courseId]);

  const mIdx = parseInt(moduleIndex || '0');
  const quiz = course?.curriculum?.[mIdx]?.quiz;

  useEffect(() => {
    if (!user || !courseId || !quiz) {
      if (!quiz && !loading) setLoading(false);
      return;
    }

    const attemptId = `${user.uid}_${courseId}_${quiz.id}`;
    const unsubscribe = onSnapshot(doc(db, 'quizAttempts', attemptId), (docSnap) => {
      if (docSnap.exists()) {
        setQuizAttempt(docSnap.data());
        setIsSubmitted(true);
        setScore(docSnap.data().score);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, courseId, quiz]);

  const handleOptionSelect = (questionId: string, optionIndex: number) => {
    if (isSubmitted) return;
    setSelectedAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmit = async () => {
    if (!user || !courseId || !quiz) return;

    let correctCount = 0;
    quiz.questions.forEach(q => {
      if (selectedAnswers[q.id] === q.correctAnswer) {
        correctCount++;
      }
    });

    const totalQuestions = quiz.questions.length;
    const passed = (correctCount / totalQuestions) >= 0.7; // 70% to pass

    try {
      const attemptId = `${user.uid}_${courseId}_${quiz.id}`;
      await setDoc(doc(db, 'quizAttempts', attemptId), {
        userId: user.uid,
        courseId,
        quizId: quiz.id,
        score: correctCount,
        totalQuestions,
        passed,
        completedAt: serverTimestamp()
      });
      
      setScore(correctCount);
      setIsSubmitted(true);
    } catch (error) {
      console.error("Error saving quiz attempt:", error);
    }
  };

  const handleRetry = () => {
    setIsSubmitted(false);
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setScore(0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-12 h-12 animate-spin text-blue-900" />
      </div>
    );
  }

  if (!course || !quiz) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Quiz not found</h2>
        <Link to="/dashboard">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === quiz.questions.length - 1;
  const allAnswered = Object.keys(selectedAnswers).length === quiz.questions.length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-slate-100 flex items-center justify-between px-6 bg-white sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link to={`/course/${courseId}`} className="flex items-center gap-2 text-slate-500 hover:text-blue-900 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-bold hidden sm:inline">Back to Course</span>
          </Link>
          <div className="h-4 w-px bg-slate-200 mx-2 hidden sm:block" />
          <h1 className="text-sm font-bold text-slate-900 truncate">
            {quiz.title}
          </h1>
        </div>
        <div className="text-sm font-bold text-slate-400">
          Question {currentQuestionIndex + 1} of {quiz.questions.length}
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full">
          <AnimatePresence mode="wait">
            {!isSubmitted ? (
              <motion.div
                key="quiz"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-3xl p-8 md:p-12 shadow-xl shadow-slate-200/50 border border-slate-100"
              >
                <div className="mb-8">
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-8">
                    <div 
                      className="h-full bg-blue-900 transition-all duration-500" 
                      style={{ width: `${((currentQuestionIndex + 1) / quiz.questions.length) * 100}%` }}
                    />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 leading-tight">
                    {currentQuestion.question}
                  </h2>
                </div>

                <div className="space-y-4 mb-12">
                  {currentQuestion.options.map((option, idx) => {
                    const isSelected = selectedAnswers[currentQuestion.id] === idx;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleOptionSelect(currentQuestion.id, idx)}
                        className={`w-full text-left p-6 rounded-2xl border-2 transition-all flex items-center justify-between group ${
                          isSelected 
                            ? 'border-blue-900 bg-blue-50/50 text-blue-900' 
                            : 'border-slate-100 hover:border-slate-200 text-slate-600'
                        }`}
                      >
                        <span className="font-medium">{option}</span>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                          isSelected ? 'border-blue-900 bg-blue-900 text-white' : 'border-slate-200 group-hover:border-slate-300'
                        }`}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentQuestionIndex === 0}
                    className="rounded-full px-8"
                  >
                    Previous
                  </Button>
                  
                  {isLastQuestion ? (
                    <Button
                      onClick={handleSubmit}
                      disabled={!allAnswered}
                      className="rounded-full px-12 bg-blue-900 hover:bg-blue-800 shadow-lg shadow-blue-900/20"
                    >
                      Submit Quiz
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                      disabled={selectedAnswers[currentQuestion.id] === undefined}
                      className="rounded-full px-12"
                    >
                      Next Question
                    </Button>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-3xl p-12 text-center shadow-xl shadow-slate-200/50 border border-slate-100"
              >
                <div className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center mb-8 ${
                  (score / quiz.questions.length) >= 0.7 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                }`}>
                  {(score / quiz.questions.length) >= 0.7 ? <Trophy className="w-12 h-12" /> : <XCircle className="w-12 h-12" />}
                </div>

                <h2 className="text-3xl font-bold text-slate-900 mb-2">
                  {(score / quiz.questions.length) >= 0.7 ? "Congratulations!" : "Keep Practicing!"}
                </h2>
                <p className="text-slate-500 mb-8">
                  You scored <span className="font-bold text-slate-900">{score} out of {quiz.questions.length}</span>
                </p>

                <div className="grid grid-cols-2 gap-4 mb-12">
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Score</p>
                    <p className="text-2xl font-bold text-slate-900">{Math.round((score / quiz.questions.length) * 100)}%</p>
                  </div>
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
                    <p className={`text-2xl font-bold ${(score / quiz.questions.length) >= 0.7 ? 'text-green-600' : 'text-red-600'}`}>
                      {(score / quiz.questions.length) >= 0.7 ? "Passed" : "Failed"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Button onClick={handleRetry} variant="outline" className="rounded-full px-8 w-full sm:w-auto">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry Quiz
                  </Button>
                  <Link to="/dashboard" className="w-full sm:w-auto">
                    <Button className="rounded-full px-8 w-full">
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Back to Dashboard
                    </Button>
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

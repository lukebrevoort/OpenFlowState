/**
 * Canvas LMS API Client
 *
 * Lightweight API wrapper for Canvas LMS REST API.
 *
 * Auth Modes:
 * - Token: CANVAS_API_TOKEN (default when set)
 * - Browser session: Playwright login + storage state cookies (for schools that block tokens)
 *
 * API Documentation: https://canvas.instructure.com/doc/api/
 */
export declare function browserLoginWithPlaywright(options?: {
    canvasApiUrl?: string;
    storageStatePath?: string;
    loginUrl?: string;
    timeoutMs?: number;
    headless?: boolean;
    confirmationFilePath?: string;
}): Promise<{
    storageStatePath: string;
    userId?: number;
    userName?: string;
}>;
export interface CanvasCourse {
    id: number;
    name: string;
    course_code: string;
    enrollment_term_id: number;
    start_at: string | null;
    end_at: string | null;
    workflow_state: string;
    total_students?: number;
    created_at: string;
    enrollments?: Array<{
        grades?: {
            current_grade?: string | null;
            current_score?: number | null;
            final_grade?: string | null;
            final_score?: number | null;
        };
    }>;
}
export interface CanvasAssignment {
    id: number;
    name: string;
    description: string | null;
    due_at: string | null;
    unlock_at: string | null;
    lock_at: string | null;
    points_possible: number;
    course_id: number;
    submission_types: string[];
    has_submitted_submissions: boolean;
    html_url: string;
    created_at: string;
    updated_at: string;
}
export interface CanvasSubmission {
    id: number;
    assignment_id: number;
    user_id: number;
    submitted_at: string | null;
    score: number | null;
    grade: string | null;
    grade_matches_current_submission: boolean;
    workflow_state: string;
    late: boolean;
    missing: boolean;
    excused: boolean;
    attempt: number | null;
    attachments?: Array<{
        id: number;
        filename: string;
        size?: number;
        content_type?: string;
        'content-type'?: string;
        url?: string;
        download_url?: string;
    }>;
}
export interface CanvasAnnouncement {
    id: number;
    title: string;
    message: string;
    posted_at: string;
    author: {
        id: number;
        display_name: string;
    };
    context_code: string;
}
export interface CanvasModule {
    id: number;
    name: string;
    position: number;
    unlock_at: string | null;
    require_sequential_progress: boolean;
    items_count: number;
    state: string;
}
export interface CanvasModuleItem {
    id: number;
    module_id: number;
    title: string;
    position: number;
    type: string;
    content_id?: number;
    html_url: string;
    url?: string;
    completion_requirement?: {
        type: string;
        completed: boolean;
    };
}
export interface CanvasGrade {
    course_id: number;
    course_name: string;
    current_grade: string | null;
    current_score: number | null;
    final_grade: string | null;
    final_score: number | null;
}
export interface CanvasEnrollment {
    id: number;
    course_id: number;
    type: string;
    enrollment_state: string;
    grades?: {
        current_grade: string | null;
        current_score: number | null;
        final_grade: string | null;
        final_score: number | null;
    };
}
export interface CanvasTodoItem {
    type: string;
    assignment?: CanvasAssignment;
    context_type: string;
    context_name: string;
    html_url: string;
}
export interface CanvasFile {
    id: number;
    display_name: string;
    filename: string;
    size: number;
    content_type?: string;
    'content-type'?: string;
    url?: string;
    download_url?: string;
    created_at?: string;
    modified_at?: string;
}
export type CanvasDownloadedFile = {
    file: CanvasFile;
    buffer: Buffer;
    contentType: string;
    finalUrl: string;
};
/**
 * Get all courses for the current user
 */
export declare function getCourses(options?: {
    enrollmentState?: 'active' | 'completed' | 'all';
    includeGrades?: boolean;
}): Promise<CanvasCourse[]>;
/**
 * Get a specific course by ID
 */
export declare function getCourse(courseId: number): Promise<CanvasCourse>;
/**
 * Get assignments for a course
 */
export declare function getAssignments(courseId: number, options?: {
    orderBy?: 'due_at' | 'name' | 'position';
    includeSubmission?: boolean;
}): Promise<CanvasAssignment[]>;
/**
 * Get a specific assignment
 */
export declare function getAssignment(courseId: number, assignmentId: number): Promise<CanvasAssignment>;
/**
 * Get upcoming assignments across all courses
 */
export declare function getUpcomingAssignments(): Promise<CanvasTodoItem[]>;
/**
 * Get submissions for a course assignment
 */
export declare function getSubmission(courseId: number, assignmentId: number): Promise<CanvasSubmission>;
/**
 * Get all submissions for a user in a course
 */
export declare function getCourseSubmissions(courseId: number): Promise<CanvasSubmission[]>;
/**
 * Get announcements for courses
 */
export declare function getAnnouncements(courseIds: number[], options?: {
    startDate?: string;
    endDate?: string;
    activeOnly?: boolean;
}): Promise<CanvasAnnouncement[]>;
/**
 * Get modules for a course
 */
export declare function getModules(courseId: number): Promise<CanvasModule[]>;
/**
 * Get items within a module
 */
export declare function getModuleItems(courseId: number, moduleId: number): Promise<CanvasModuleItem[]>;
/**
 * Get grades for all enrolled courses
 */
export declare function getGrades(): Promise<CanvasGrade[]>;
/**
 * Get the user's calendar events and assignments
 */
export declare function getCalendarEvents(options?: {
    startDate?: string;
    endDate?: string;
    type?: 'event' | 'assignment';
}): Promise<Array<{
    id: number;
    title: string;
    start_at: string;
    end_at: string;
    type: string;
    context_code: string;
    html_url: string;
}>>;
export declare function listCourseFiles(courseId: number): Promise<CanvasFile[]>;
export declare function getFile(fileId: number): Promise<CanvasFile>;
export declare function getSubmissionDetailed(courseId: number, assignmentId: number): Promise<CanvasSubmission>;
export declare function downloadFileByUrl(fileUrl: string, options?: {
    maxRedirects?: number;
}): Promise<{
    buffer: Buffer;
    contentType: string;
    finalUrl: string;
}>;
export declare function downloadFileById(fileId: number): Promise<CanvasDownloadedFile>;

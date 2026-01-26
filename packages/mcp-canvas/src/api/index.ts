/**
 * Canvas LMS API Client
 * 
 * Lightweight API wrapper for Canvas LMS REST API.
 * Uses user-generated API tokens for authentication.
 * 
 * API Documentation: https://canvas.instructure.com/doc/api/
 */

// Canvas API configuration from environment
const getCanvasConfig = () => {
  const token = process.env.CANVAS_API_TOKEN;
  const baseUrl = process.env.CANVAS_API_URL || process.env.CANVAS_BASE_URL;

  if (!token) {
    throw new Error(
      'CANVAS_API_TOKEN environment variable is required. ' +
      'Generate a token from Canvas Settings > Approved Integrations > New Access Token.'
    );
  }

  if (!baseUrl) {
    throw new Error(
      'CANVAS_API_URL or CANVAS_BASE_URL environment variable is required. ' +
      'Example: https://your-school.instructure.com'
    );
  }

  // Normalize base URL - remove trailing slash
  const normalizedUrl = baseUrl.replace(/\/$/, '');

  return { token, baseUrl: normalizedUrl };
};

const resolveUrl = (candidate: string, base: string) => {
  try {
    return new URL(candidate, base).toString();
  } catch {
    return candidate;
  }
};

// Generic fetch wrapper for Canvas API
async function canvasFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const { token, baseUrl } = getCanvasConfig();
  
  const url = `${baseUrl}/api/v1${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Canvas API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

// Authenticated fetch for absolute Canvas URLs (used for file downloads).
async function canvasFetchRaw(
  url: string,
  options: RequestInit & { includeAuth?: boolean } = {}
): Promise<Response> {
  const { token } = getCanvasConfig();
  const includeAuth = options.includeAuth !== false;
  const { includeAuth: _ignored, ...rest } = options;

  return fetch(url, {
    ...rest,
    headers: includeAuth
      ? {
          Authorization: `Bearer ${token}`,
          ...(rest.headers ?? {}),
        }
      : rest.headers,
  });
}

// ============================================================================
// Type Definitions
// ============================================================================

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
  // Grades included when includeGrades=true
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

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get all courses for the current user
 */
export async function getCourses(options?: {
  enrollmentState?: 'active' | 'completed' | 'all';
  includeGrades?: boolean;
}): Promise<CanvasCourse[]> {
  const params = new URLSearchParams();
  
  if (options?.enrollmentState) {
    params.append('enrollment_state', options.enrollmentState);
  }
  
  if (options?.includeGrades) {
    params.append('include[]', 'total_scores');
  }
  
  const queryString = params.toString();
  const endpoint = `/courses${queryString ? `?${queryString}` : ''}`;
  
  return canvasFetch<CanvasCourse[]>(endpoint);
}

/**
 * Get a specific course by ID
 */
export async function getCourse(courseId: number): Promise<CanvasCourse> {
  return canvasFetch<CanvasCourse>(`/courses/${courseId}`);
}

/**
 * Get assignments for a course
 */
export async function getAssignments(
  courseId: number,
  options?: {
    orderBy?: 'due_at' | 'name' | 'position';
    includeSubmission?: boolean;
  }
): Promise<CanvasAssignment[]> {
  const params = new URLSearchParams();
  
  if (options?.orderBy) {
    params.append('order_by', options.orderBy);
  }
  
  if (options?.includeSubmission) {
    params.append('include[]', 'submission');
  }
  
  const queryString = params.toString();
  const endpoint = `/courses/${courseId}/assignments${queryString ? `?${queryString}` : ''}`;
  
  return canvasFetch<CanvasAssignment[]>(endpoint);
}

/**
 * Get a specific assignment
 */
export async function getAssignment(
  courseId: number,
  assignmentId: number
): Promise<CanvasAssignment> {
  return canvasFetch<CanvasAssignment>(
    `/courses/${courseId}/assignments/${assignmentId}`
  );
}

/**
 * Get upcoming assignments across all courses
 */
export async function getUpcomingAssignments(): Promise<CanvasTodoItem[]> {
  return canvasFetch<CanvasTodoItem[]>('/users/self/todo');
}

/**
 * Get submissions for a course assignment
 */
export async function getSubmission(
  courseId: number,
  assignmentId: number
): Promise<CanvasSubmission> {
  return canvasFetch<CanvasSubmission>(
    `/courses/${courseId}/assignments/${assignmentId}/submissions/self`
  );
}

/**
 * Get all submissions for a user in a course
 */
export async function getCourseSubmissions(
  courseId: number
): Promise<CanvasSubmission[]> {
  return canvasFetch<CanvasSubmission[]>(
    `/courses/${courseId}/students/submissions?student_ids[]=self`
  );
}

/**
 * Get announcements for courses
 */
export async function getAnnouncements(
  courseIds: number[],
  options?: {
    startDate?: string;
    endDate?: string;
    activeOnly?: boolean;
  }
): Promise<CanvasAnnouncement[]> {
  const params = new URLSearchParams();
  
  courseIds.forEach(id => {
    params.append('context_codes[]', `course_${id}`);
  });
  
  if (options?.startDate) {
    params.append('start_date', options.startDate);
  }
  
  if (options?.endDate) {
    params.append('end_date', options.endDate);
  }
  
  if (options?.activeOnly) {
    params.append('active_only', 'true');
  }
  
  return canvasFetch<CanvasAnnouncement[]>(`/announcements?${params.toString()}`);
}

/**
 * Get modules for a course
 */
export async function getModules(courseId: number): Promise<CanvasModule[]> {
  return canvasFetch<CanvasModule[]>(`/courses/${courseId}/modules`);
}

/**
 * Get items within a module
 */
export async function getModuleItems(
  courseId: number,
  moduleId: number
): Promise<CanvasModuleItem[]> {
  return canvasFetch<CanvasModuleItem[]>(
    `/courses/${courseId}/modules/${moduleId}/items`
  );
}

/**
 * Get grades for all enrolled courses
 */
export async function getGrades(): Promise<CanvasGrade[]> {
  const enrollments = await canvasFetch<CanvasEnrollment[]>(
    '/users/self/enrollments?type[]=StudentEnrollment&include[]=grades'
  );
  
  return enrollments.map(enrollment => ({
    course_id: enrollment.course_id,
    course_name: '', // Will be populated by caller if needed
    current_grade: enrollment.grades?.current_grade ?? null,
    current_score: enrollment.grades?.current_score ?? null,
    final_grade: enrollment.grades?.final_grade ?? null,
    final_score: enrollment.grades?.final_score ?? null,
  }));
}

/**
 * Get the user's calendar events and assignments
 */
export async function getCalendarEvents(options?: {
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
}>> {
  const params = new URLSearchParams();
  
  if (options?.startDate) {
    params.append('start_date', options.startDate);
  }
  
  if (options?.endDate) {
    params.append('end_date', options.endDate);
  }
  
  if (options?.type) {
    params.append('type', options.type);
  }
  
  params.append('all_events', 'true');
  
  return canvasFetch(`/calendar_events?${params.toString()}`);
}

// =========================================================================
// Files + Submissions Attachments
// =========================================================================

export async function listCourseFiles(courseId: number): Promise<CanvasFile[]> {
  const params = new URLSearchParams();
  params.append('per_page', '100');
  return canvasFetch<CanvasFile[]>(`/courses/${courseId}/files?${params.toString()}`);
}

export async function getFile(fileId: number): Promise<CanvasFile> {
  return canvasFetch<CanvasFile>(`/files/${fileId}`);
}

export async function getSubmissionDetailed(
  courseId: number,
  assignmentId: number
): Promise<CanvasSubmission> {
  const params = new URLSearchParams();
  params.append('include[]', 'submission_history');
  params.append('include[]', 'submission_comments');
  params.append('include[]', 'rubric_assessment');
  return canvasFetch<CanvasSubmission>(
    `/courses/${courseId}/assignments/${assignmentId}/submissions/self?${params.toString()}`
  );
}

export async function downloadFileByUrl(
  fileUrl: string,
  options?: { maxRedirects?: number }
): Promise<{ buffer: Buffer; contentType: string; finalUrl: string }> {
  const { baseUrl } = getCanvasConfig();
  const maxRedirects = options?.maxRedirects ?? 10;
  const base = new URL(baseUrl);

  let currentUrl = fileUrl;

  for (let i = 0; i < maxRedirects; i += 1) {
    const parsed = new URL(currentUrl);
    const includeAuth = parsed.host === base.host;

    const response = await canvasFetchRaw(currentUrl, {
      redirect: 'manual',
      includeAuth,
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        throw new Error('Canvas file download redirect missing Location header.');
      }
      currentUrl = resolveUrl(location, currentUrl);
      continue;
    }

    if (response.status === 401 || response.status === 403) {
      if (includeAuth) {
        const body = await response.text();
        throw new Error(`Canvas file download unauthorized (${response.status}): ${body}`);
      }
      throw new Error(
        'This file appears to be hosted outside Canvas and requires browser authentication. ' +
          'Please upload it or paste the relevant text.'
      );
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Canvas file download failed (${response.status}): ${body}`);
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType,
      finalUrl: currentUrl,
    };
  }

  throw new Error(`Canvas file download exceeded ${maxRedirects} redirects.`);
}

export async function downloadFileById(fileId: number): Promise<CanvasDownloadedFile> {
  const file = await getFile(fileId);
  const url = file.download_url ?? file.url;
  if (!url) {
    throw new Error(`Canvas file ${fileId} has no download URL.`);
  }

  const downloaded = await downloadFileByUrl(url);
  return {
    file,
    buffer: downloaded.buffer,
    contentType: file.content_type ?? file['content-type'] ?? downloaded.contentType,
    finalUrl: downloaded.finalUrl,
  };
}

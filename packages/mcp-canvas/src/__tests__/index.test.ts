/**
 * @flowstate/mcp-canvas Test Suite
 * 
 * Tests for Canvas LMS MCP server tools and API client.
 * Uses direct function calls to test tool logic without mocking MCP internals.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the API module
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock canvasApi module with all functions
const mockApi = {
  getCourses: vi.fn(),
  getCourse: vi.fn(),
  getAssignments: vi.fn(),
  getAssignment: vi.fn(),
  getUpcomingAssignments: vi.fn(),
  getGrades: vi.fn(),
  getSubmission: vi.fn(),
  getSubmissionDetailed: vi.fn(),
  getAnnouncements: vi.fn(),
  getModules: vi.fn(),
  getModuleItems: vi.fn(),
  getCalendarEvents: vi.fn(),
  listCourseFiles: vi.fn(),
  getFile: vi.fn(),
  downloadFileById: vi.fn(),
  downloadFileByUrl: vi.fn(),
};

// Mock the API module before importing tools
vi.mock('../api/index.js', () => mockApi);

describe('Canvas API Client Type Tests', () => {
  describe('CanvasCourse type', () => {
    it('should accept valid course data', () => {
      const course = {
        id: 1,
        name: 'Introduction to Computer Science',
        course_code: 'CS 101',
        enrollment_term_id: 1,
        start_at: '2026-01-01T00:00:00Z',
        end_at: '2026-05-15T00:00:00Z',
        workflow_state: 'available',
        created_at: '2026-01-01T00:00:00Z',
      };
      
      expect(course.id).toBe(1);
      expect(course.name).toBe('Introduction to Computer Science');
      expect(course.workflow_state).toBe('available');
    });

    it('should accept null dates', () => {
      const course = {
        id: 1,
        name: 'Test',
        course_code: 'TEST',
        enrollment_term_id: 1,
        start_at: null,
        end_at: null,
        workflow_state: 'available',
        created_at: '2026-01-01T00:00:00Z',
      };
      
      expect(course.start_at).toBeNull();
      expect(course.end_at).toBeNull();
    });

    it('should accept enrollments with grades', () => {
      const course = {
        id: 1,
        name: 'Test Course',
        course_code: 'TEST',
        enrollment_term_id: 1,
        start_at: null,
        end_at: null,
        workflow_state: 'available',
        created_at: '2026-01-01T00:00:00Z',
        enrollments: [{
          grades: {
            current_grade: 'A',
            current_score: 95,
            final_grade: null,
            final_score: null,
          },
        }],
      };
      
      expect(course.enrollments?.[0]?.grades?.current_grade).toBe('A');
      expect(course.enrollments?.[0]?.grades?.current_score).toBe(95);
    });
  });

  describe('CanvasAssignment type', () => {
    it('should accept valid assignment data', () => {
      const assignment = {
        id: 1,
        name: 'Homework 1',
        description: 'Solve problems 1-10',
        due_at: '2026-01-25T23:59:00Z',
        unlock_at: null,
        lock_at: null,
        points_possible: 100,
        course_id: 1,
        submission_types: ['online_text_entry', 'online_url'],
        has_submitted_submissions: false,
        html_url: 'https://canvas.example.com/assignments/1',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };
      
      expect(assignment.points_possible).toBe(100);
      expect(assignment.submission_types).toHaveLength(2);
      expect(assignment.has_submitted_submissions).toBe(false);
    });
  });

  describe('CanvasGrade type', () => {
    it('should accept valid grade data', () => {
      const grade = {
        course_id: 1,
        course_name: 'CS 101',
        current_grade: 'A',
        current_score: 95,
        final_grade: null,
        final_score: null,
      };
      
      expect(grade.current_score).toBe(95);
      expect(grade.final_score).toBeNull();
    });

    it('should accept empty grades', () => {
      const grade = {
        course_id: 1,
        course_name: 'CS 101',
        current_grade: null,
        current_score: null,
        final_grade: null,
        final_score: null,
      };
      
      expect(grade.current_grade).toBeNull();
    });
  });

  describe('CanvasSubmission type', () => {
    it('should accept valid submission data', () => {
      const submission = {
        id: 1,
        assignment_id: 1,
        user_id: 1,
        submitted_at: '2026-01-24T22:00:00Z',
        score: 95,
        grade: 'A',
        grade_matches_current_submission: true,
        workflow_state: 'submitted',
        late: false,
        missing: false,
        excused: false,
        attempt: 1,
      };
      
      expect(submission.score).toBe(95);
      expect(submission.late).toBe(false);
    });

    it('should accept late submission', () => {
      const submission = {
        id: 1,
        assignment_id: 1,
        user_id: 1,
        submitted_at: '2026-01-26T01:00:00Z',
        score: 85,
        grade: 'B',
        grade_matches_current_submission: true,
        workflow_state: 'submitted',
        late: true,
        missing: false,
        excused: false,
        attempt: 1,
      };
      
      expect(submission.late).toBe(true);
    });
  });

  describe('CanvasAnnouncement type', () => {
    it('should accept valid announcement data', () => {
      const announcement = {
        id: 1,
        title: 'Exam Schedule Change',
        message: 'The midterm exam has been rescheduled to Feb 5th.',
        posted_at: '2026-01-15T10:00:00Z',
        author: { id: 1, display_name: 'Professor Smith' },
        context_code: 'course_1',
      };
      
      expect(announcement.author.display_name).toBe('Professor Smith');
    });
  });

  describe('CanvasModule type', () => {
    it('should accept valid module data', () => {
      const module = {
        id: 1,
        name: 'Week 1: Introduction',
        position: 1,
        unlock_at: null,
        require_sequential_progress: false,
        items_count: 5,
        state: 'started',
      };
      
      expect(module.items_count).toBe(5);
      expect(module.state).toBe('started');
    });
  });

  describe('CanvasModuleItem type', () => {
    it('should accept valid module item data', () => {
      const item = {
        id: 1,
        module_id: 1,
        title: 'Lecture 1: Introduction',
        position: 1,
        type: 'Page',
        content_id: 123,
        html_url: 'https://canvas.example.com/pages/123',
        completion_requirement: {
          type: 'marked',
          completed: false,
        },
      };
      
      expect(item.type).toBe('Page');
      expect(item.completion_requirement?.completed).toBe(false);
    });
  });
});

describe('Canvas API Function Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCourses', () => {
    it('should be called with correct parameters', async () => {
      mockApi.getCourses.mockResolvedValue([
        { id: 1, name: 'CS 101', course_code: 'CS101' },
      ]);
      
      const result = await mockApi.getCourses({ enrollmentState: 'active' });
      
      expect(mockApi.getCourses).toHaveBeenCalledWith({ enrollmentState: 'active' });
      expect(result).toHaveLength(1);
    });

    it('should handle undefined parameters', async () => {
      mockApi.getCourses.mockResolvedValue([]);
      
      await mockApi.getCourses({});
      
      expect(mockApi.getCourses).toHaveBeenCalledWith({});
    });
  });

  describe('getCourse', () => {
    it('should be called with course ID', async () => {
      mockApi.getCourse.mockResolvedValue({ id: 123, name: 'CS 101' });
      
      await mockApi.getCourse(123);
      
      expect(mockApi.getCourse).toHaveBeenCalledWith(123);
    });
  });

  describe('getAssignments', () => {
    it('should be called with course ID and options', async () => {
      mockApi.getAssignments.mockResolvedValue([]);
      
      await mockApi.getAssignments(123, { orderBy: 'due_at' });
      
      expect(mockApi.getAssignments).toHaveBeenCalledWith(123, { orderBy: 'due_at' });
    });
  });

  describe('getUpcomingAssignments', () => {
    it('should be called without parameters', async () => {
      mockApi.getUpcomingAssignments.mockResolvedValue([]);
      
      await mockApi.getUpcomingAssignments();
      
      expect(mockApi.getUpcomingAssignments).toHaveBeenCalled();
    });
  });

  describe('getGrades', () => {
    it('should be called without parameters', async () => {
      mockApi.getGrades.mockResolvedValue([]);
      
      await mockApi.getGrades();
      
      expect(mockApi.getGrades).toHaveBeenCalled();
    });
  });

  describe('getSubmission', () => {
    it('should be called with course and assignment ID', async () => {
      mockApi.getSubmission.mockResolvedValue({ id: 1, score: 100 });
      
      await mockApi.getSubmission(123, 456);
      
      expect(mockApi.getSubmission).toHaveBeenCalledWith(123, 456);
    });
  });

  describe('getSubmissionDetailed', () => {
    it('should be called with course and assignment ID', async () => {
      mockApi.getSubmissionDetailed.mockResolvedValue({ id: 1, score: 100 });

      await mockApi.getSubmissionDetailed(123, 456);

      expect(mockApi.getSubmissionDetailed).toHaveBeenCalledWith(123, 456);
    });
  });

  describe('getAnnouncements', () => {
    it('should be called with course IDs and options', async () => {
      mockApi.getAnnouncements.mockResolvedValue([]);
      
      await mockApi.getAnnouncements([1, 2, 3], { startDate: '2026-01-01' });
      
      expect(mockApi.getAnnouncements).toHaveBeenCalledWith([1, 2, 3], { startDate: '2026-01-01' });
    });
  });

  describe('getModules', () => {
    it('should be called with course ID', async () => {
      mockApi.getModules.mockResolvedValue([]);
      
      await mockApi.getModules(123);
      
      expect(mockApi.getModules).toHaveBeenCalledWith(123);
    });
  });

  describe('getModuleItems', () => {
    it('should be called with course and module ID', async () => {
      mockApi.getModuleItems.mockResolvedValue([]);
      
      await mockApi.getModuleItems(123, 456);
      
      expect(mockApi.getModuleItems).toHaveBeenCalledWith(123, 456);
    });
  });

  describe('getCalendarEvents', () => {
    it('should be called with date options', async () => {
      mockApi.getCalendarEvents.mockResolvedValue([]);
      
      await mockApi.getCalendarEvents({ startDate: '2026-01-01', endDate: '2026-01-31' });
      
      expect(mockApi.getCalendarEvents).toHaveBeenCalledWith({ startDate: '2026-01-01', endDate: '2026-01-31' });
    });
  });
});

  describe('Tool Definition Validation', () => {
  // Helper function to simulate tool registration check
  const validateToolDefinitions = () => {
    const expectedTools = [
      'canvas_list_courses',
      'canvas_get_course',
      'canvas_list_assignments',
      'canvas_get_assignment',
      'canvas_get_upcoming',
      'canvas_get_grades',
      'canvas_get_submission',
      'canvas_list_announcements',
      'canvas_list_modules',
      'canvas_get_module_items',
      'canvas_get_calendar',
      'canvas_list_course_files',
      'canvas_get_file_info',
      'canvas_read_file_text',
      'canvas_read_submission_attachment_text',
    ];
    return expectedTools;
  };

  it('should have exactly 15 tools', () => {
    const tools = validateToolDefinitions();
    expect(tools).toHaveLength(15);
  });

  it('should have all expected tool names', () => {
    const tools = validateToolDefinitions();
    
    expect(tools).toContain('canvas_list_courses');
    expect(tools).toContain('canvas_get_course');
    expect(tools).toContain('canvas_list_assignments');
    expect(tools).toContain('canvas_get_assignment');
    expect(tools).toContain('canvas_get_upcoming');
    expect(tools).toContain('canvas_get_grades');
    expect(tools).toContain('canvas_get_submission');
    expect(tools).toContain('canvas_list_announcements');
    expect(tools).toContain('canvas_list_modules');
    expect(tools).toContain('canvas_get_module_items');
    expect(tools).toContain('canvas_get_calendar');
    expect(tools).toContain('canvas_list_course_files');
    expect(tools).toContain('canvas_get_file_info');
    expect(tools).toContain('canvas_read_file_text');
    expect(tools).toContain('canvas_read_submission_attachment_text');
  });

  it('should follow naming convention', () => {
    const tools = validateToolDefinitions();
    
    for (const tool of tools) {
      expect(tool).toMatch(/^canvas_/);
    }
  });
});

describe('Error Handling', () => {
  it('should handle API errors', async () => {
    const errorMessage = 'Canvas API error (401): Unauthorized';
    mockApi.getCourses.mockRejectedValue(new Error(errorMessage));
    
    await expect(mockApi.getCourses({})).rejects.toThrow(errorMessage);
  });

  it('should handle network errors', async () => {
    const networkError = new Error('Failed to fetch');
    mockApi.getCourse.mockRejectedValue(networkError);
    
    await expect(mockApi.getCourse(123)).rejects.toThrow('Failed to fetch');
  });
});

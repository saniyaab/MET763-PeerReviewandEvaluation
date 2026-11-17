// =============================================================================
// Language/Stack: TypeScript 5.9 | Node.js 22 | Express 5 | PostgreSQL 17 (pg)
// Tool: Claude Code agent harness (Claude desktop app), model claude-opus-5-5
// Prompt Summary: "build every Domain 3 requirement and endpoint from
//   ProjectPortalDomainServices.pdf in functional-codebase/" (PA2 happy-path
//   prompt; full verbatim text in /.ai_logs/)
// AI Contribution: 100% AI generated / 0% human refactored
// Human Modifications: none
// Verification:
//   - CI: build + unit + API integration tests in .github/workflows/devsecops.yml
//   - Human review: PENDING (student must review and sign off)
// Confidence: Medium
// File purpose: local static mock data for data owned by other Project Portal
//   services (users, courses, labs, projects). Seeded into reference tables at
//   startup so the service never calls another student's service.
// =============================================================================

export type UserRole = "faculty_instructor" | "student_peer";

export interface MockUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface MockCourse {
  id: string;
  title: string;
  term: string;
}

export interface MockLab {
  id: string;
  name: string;
  department: string;
}

export interface MockProject {
  id: string;
  title: string;
  courseId: string;
  labId: string | null;
  memberIds: string[];
}

export const USERS: MockUser[] = [
  { id: "10000000-0000-4000-8000-000000000001", name: "Dr. Elena Ruiz", email: "eruiz@bu.example.edu", role: "faculty_instructor" },
  { id: "10000000-0000-4000-8000-000000000002", name: "Prof. Marcus Lee", email: "mlee@bu.example.edu", role: "faculty_instructor" },
  { id: "10000000-0000-4000-8000-000000000003", name: "Dr. Priya Nair", email: "pnair@bu.example.edu", role: "faculty_instructor" },
  { id: "20000000-0000-4000-8000-000000000001", name: "Ava Thompson", email: "avat@bu.example.edu", role: "student_peer" },
  { id: "20000000-0000-4000-8000-000000000002", name: "Ben Okafor", email: "bokafor@bu.example.edu", role: "student_peer" },
  { id: "20000000-0000-4000-8000-000000000003", name: "Chloe Kim", email: "ckim@bu.example.edu", role: "student_peer" },
  { id: "20000000-0000-4000-8000-000000000004", name: "Diego Alvarez", email: "dalvarez@bu.example.edu", role: "student_peer" },
  { id: "20000000-0000-4000-8000-000000000005", name: "Emma Singh", email: "esingh@bu.example.edu", role: "student_peer" },
  { id: "20000000-0000-4000-8000-000000000006", name: "Farah Haddad", email: "fhaddad@bu.example.edu", role: "student_peer" },
];

export const COURSES: MockCourse[] = [
  { id: "CS501", title: "Software Engineering", term: "Fall 2026" },
  { id: "CS763", title: "Secure Software Development", term: "Fall 2026" },
  { id: "EC544", title: "Networking the Physical World", term: "Fall 2026" },
];

export const LABS: MockLab[] = [
  { id: "lab_cybersec", name: "Cybersecurity Research Lab", department: "Computer Science" },
  { id: "lab_robotics", name: "Robotics & Autonomy Lab", department: "Electrical & Computer Engineering" },
  { id: "lab_hci", name: "Human-Computer Interaction Lab", department: "Computer Science" },
];

export const PROJECTS: MockProject[] = [
  { id: "30000000-0000-4000-8000-000000000001", title: "Secure Grade Portal", courseId: "CS763", labId: "lab_cybersec", memberIds: ["20000000-0000-4000-8000-000000000001", "20000000-0000-4000-8000-000000000002"] },
  { id: "30000000-0000-4000-8000-000000000002", title: "Threat Model Visualizer", courseId: "CS763", labId: "lab_cybersec", memberIds: ["20000000-0000-4000-8000-000000000003"] },
  { id: "30000000-0000-4000-8000-000000000003", title: "Phishing Email Detector", courseId: "CS763", labId: null, memberIds: ["20000000-0000-4000-8000-000000000004"] },
  { id: "30000000-0000-4000-8000-000000000004", title: "Autonomous Campus Rover", courseId: "CS501", labId: "lab_robotics", memberIds: ["20000000-0000-4000-8000-000000000005"] },
  { id: "30000000-0000-4000-8000-000000000005", title: "Accessible Campus Map", courseId: "CS501", labId: "lab_hci", memberIds: ["20000000-0000-4000-8000-000000000006"] },
  { id: "30000000-0000-4000-8000-000000000006", title: "Voice Interface Usability Study", courseId: "CS501", labId: "lab_hci", memberIds: ["20000000-0000-4000-8000-000000000001"] },
  { id: "30000000-0000-4000-8000-000000000007", title: "Swarm Drone Mesh Network", courseId: "EC544", labId: "lab_robotics", memberIds: ["20000000-0000-4000-8000-000000000002"] },
];

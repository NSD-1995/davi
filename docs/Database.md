# Database Design

## Database Choice
PostgreSQL

## Primary Data Domains
1. Users
2. Schools
3. Classes
4. Students
5. Teachers
6. Attendance Records
7. Homework Assignments
8. Notifications
9. AI Lesson Plans
10. Audit Logs

## Core Entities
### Users
- id
- email
- password_hash
- role
- created_at

### Schools
- id
- name
- address
- created_at

### Classes
- id
- school_id
- teacher_id
- name
- grade_level

### Students
- id
- class_id
- full_name
- parent_contact

### Attendance
- id
- student_id
- class_id
- date
- status
- marked_by

### Homework
- id
- class_id
- teacher_id
- title
- description
- due_date
- status

### Notifications
- id
- user_id
- type
- message
- channel
- sent_at

### AI Lesson Plans
- id
- teacher_id
- topic
- generated_content
- created_at

## Relationships
- School has many classes
- Class has many students
- Teacher can manage many classes
- Student has many attendance records
- Class has many homework assignments
- Parent/Guardian receives notifications

## Data Security
- Enforce role-based access
- Encrypt sensitive contact information
- Store audit trails for important school operations

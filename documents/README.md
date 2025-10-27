# Sample Resume Files

Place your resume files (PDF or DOCX format) in this folder.

The ingestion pipeline will:
1. Read all .pdf and .docx files from this directory
2. Extract name, email, phone number, and full content
3. Store the data in MongoDB (db_resumes.resumes collection)

## Example Files

You can place files like:
- john_doe_resume.pdf
- jane_smith_resume.docx
- senior_developer_resume.pdf

## Run Ingestion

After adding your resume files, run:

```bash
npm run ingest
```

Or to clear existing data first:

```bash
npm run ingest:clear
```

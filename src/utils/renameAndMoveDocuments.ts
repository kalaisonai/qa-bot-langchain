import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// Read target folder from .env
const DESTINATION_FOLDER = process.env.DOCUMENTS_FOLDER || "./documents";

// Specify source folder (absolute path)
const SOURCE_FOLDER = "/Users/babu/Desktop/desktop/Deck/Post your resume here for our reference (File responses)";

const START_NUMBER = 202510001;

async function renameAndMoveFiles(): Promise<void> {
  try {
    // Validate source and destination folders
    if (!fs.existsSync(SOURCE_FOLDER)) {
      console.error(`Source folder not found: ${SOURCE_FOLDER}`);
      return;
    }

    if (!fs.existsSync(DESTINATION_FOLDER)) {
      console.log(`Destination folder not found. Creating: ${DESTINATION_FOLDER}`);
      fs.mkdirSync(DESTINATION_FOLDER, { recursive: true });
    }

    // Get list of .pdf and .docx files
    const files = fs.readdirSync(SOURCE_FOLDER);
    const targetFiles = files.filter((file) =>
      [".pdf", ".docx"].includes(path.extname(file).toLowerCase())
    );

    if (targetFiles.length === 0) {
      console.log("No PDF or DOCX files found in the source folder.");
      return;
    }

    console.log(`Found ${targetFiles.length} files in source folder.`);
    let counter = START_NUMBER;

    // Loop through files and process
    for (const file of targetFiles) {
      const ext = path.extname(file);
      const newFileName = `${counter}${ext}`;

      const oldPath = path.join(SOURCE_FOLDER, file);
      const newPath = path.join(DESTINATION_FOLDER, newFileName);

      // Move and rename
      fs.copyFileSync(oldPath, newPath); // You can switch to renameSync if you want to move instead of copy
      console.log(`Moved & renamed: ${file} → ${newFileName}`);

      counter++;
    }

    console.log("File transfer and renaming completed successfully!");
  } catch (error) {
    console.error("Error during file operation:", error);
  }
}

renameAndMoveFiles();

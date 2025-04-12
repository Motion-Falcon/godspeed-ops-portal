import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Make sure SUPABASE_URL and SUPABASE_SERVICE_KEY are set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Create readline interface for command-line interaction
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Prompt for user input
const promptQuestion = (question: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

// Main function to create an admin user
async function createAdminUser() {
  console.log('===== Admin User Creation =====');
  
  try {
    const email = await promptQuestion('Enter admin email: ');
    const password = await promptQuestion('Enter admin password: ');
    const name = await promptQuestion('Enter admin name: ');
    
    // Check if user already exists
    const { data: existingUsers, error: lookupError } = await supabase
      .from('auth.users')
      .select('id')
      .eq('email', email)
      .limit(1);
      
    if (lookupError) {
      console.error('Error checking for existing user:', lookupError.message);
      return;
    }
    
    if (existingUsers && existingUsers.length > 0) {
      // Update existing user to admin
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        existingUsers[0].id,
        {
          user_metadata: {
            name,
            user_type: 'admin'
          }
        }
      );
      
      if (updateError) {
        console.error('Error updating user to admin:', updateError.message);
        return;
      }
      
      console.log(`User ${email} updated to admin successfully!`);
    } else {
      // Create new admin user
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name,
          user_type: 'admin'
        }
      });
      
      if (error) {
        console.error('Error creating admin user:', error.message);
        return;
      }
      
      console.log(`Admin user ${email} created successfully!`);
      console.log(`User ID: ${data.user.id}`);
    }
  } catch (error) {
    console.error('An unexpected error occurred:', error);
  } finally {
    rl.close();
  }
}

// Run the script
createAdminUser(); 
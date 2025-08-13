const { PrismaClient } = require('../generated/prisma');

async function createAnonymousUser() {
  const prisma = new PrismaClient();
  
  try {
    // Check if anonymous user already exists
    const existingUser = await prisma.user.findUnique({
      where: { id: 'anonymous-user' }
    });
    
    if (existingUser) {
      console.log('Anonymous user already exists');
      return;
    }
    
    // Create anonymous user
    const user = await prisma.user.create({
      data: {
        id: 'anonymous-user',
        firstName: 'Anonymous',
        lastName: 'User',
        email: 'anonymous@example.com',
        isActive: true
      }
    });
    
    console.log('Anonymous user created:', user);
  } catch (error) {
    console.error('Error creating anonymous user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAnonymousUser();

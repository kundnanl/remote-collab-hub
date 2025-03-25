import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db'; 

export async function POST(req: NextRequest) {
  const rawBody = await req.text(); 
  const event = JSON.parse(rawBody);
  const { type, data } = event;

  if (type === 'user.created') {
    const user = data;
    const imageUrl =
    user.has_image && user.image_url
      ? user.image_url
      : "https://ui-avatars.com/api/?name=User";
  

    await prisma.user.create({
      data: {
        clerkId: user.id,
        email: user.email_addresses[0].email_address,
        name: `${user.first_name} ${user.last_name}`,
        imageUrl,
      },
    });
  }

  if (type === 'user.updated') {
    const user = data;
    const imageUrl =
    user.has_image && user.image_url
      ? user.image_url
      : "https://ui-avatars.com/api/?name=User";
  
    await prisma.user.update({
      where: { clerkId: user.id },
      data: {
        email: user.email_addresses[0].email_address,
        name: `${user.first_name} ${user.last_name}`,
        imageUrl,
      },
    });
  }

  if (type === 'user.deleted') {
    const user = data;

    await prisma.user.deleteMany({
      where: { clerkId: user.id },
    });
  }

  return NextResponse.json({ received: true });
}

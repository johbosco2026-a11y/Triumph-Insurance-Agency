import { PrismaClient, Role, MembershipRole } from '@prisma/client';
const prisma = new PrismaClient();
async function main(){
  const email='admin@triumph.local';
  const user=await prisma.user.upsert({where:{email},update:{role:Role.ADMIN},create:{email,name:'Triumph Admin',role:Role.ADMIN}});
  const org=await prisma.organization.upsert({where:{slug:'triumph-demo'},update:{},create:{name:'Triumph Insurance Agency',slug:'triumph-demo'}});
  await prisma.membership.upsert({where:{userId_organizationId:{userId:user.id,organizationId:org.id}},update:{role:MembershipRole.OWNER},create:{userId:user.id,organizationId:org.id,role:MembershipRole.OWNER}});
  console.log(`Seeded ${email} in ${org.slug}. Create credentials through Better Auth rather than storing a seed password.`);
}
main().finally(()=>prisma.$disconnect());

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit, enforceSameOrigin } from '@/lib/security/request';
const schema=z.object({userId:z.string(),role:z.enum(['MEMBER','VIEWER','ADMIN'])});
export async function PATCH(req:Request){
  const originError=enforceSameOrigin(req); if(originError)return originError;
  const limitError=await enforceRateLimit(req,'team-role',20); if(limitError)return limitError;
  const s=await auth.api.getSession({headers:await headers()}); if(!s?.user)return NextResponse.json({error:'Authentication required'},{status:401});
  const m=await prisma.membership.findFirst({where:{userId:s.user.id}}); if(!m || !(m.role==='OWNER'||m.role==='ADMIN'))return NextResponse.json({error:'Admin access required'},{status:403});
  const p=schema.safeParse(await req.json()); if(!p.success)return NextResponse.json({error:'Invalid role'},{status:400});
  if(p.data.userId===s.user.id&&p.data.role!=='ADMIN')return NextResponse.json({error:'You cannot remove your own admin access'},{status:400});
  const target=await prisma.membership.findFirst({where:{userId:p.data.userId,organizationId:m.organizationId}}); if(!target)return NextResponse.json({error:'Member not found'},{status:404});
  const updated=await prisma.membership.update({where:{id:target.id},data:{role:p.data.role}});
  await prisma.auditLog.create({data:{userId:s.user.id,organizationId:m.organizationId,action:'ROLE_CHANGED',resource:p.data.userId,metadata:{role:p.data.role}}});
  await prisma.notification.create({data:{userId:p.data.userId,type:'SYSTEM',title:'Workspace role updated',body:`Your workspace role is now ${p.data.role}.`}});
  return NextResponse.json(updated);
}

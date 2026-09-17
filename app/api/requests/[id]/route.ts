import { NextResponse } from 'next/server'; import { z } from 'zod'; import { headers } from 'next/headers'; import { auth } from '@/lib/auth'; import { prisma } from '@/lib/prisma'; import { enforceRateLimit, enforceSameOrigin } from '@/lib/security/request';
const schema=z.object({status:z.enum(['NEW','IN_REVIEW','CONTACTED','PROCESSING','APPROVED','REJECTED','CLOSED'])});
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 const originError=enforceSameOrigin(req);if(originError)return originError;const limitError=await enforceRateLimit(req,'request-status',60);if(limitError)return limitError;
 const s=await auth.api.getSession({headers:await headers()});if(!s?.user)return NextResponse.json({error:'Authentication required'},{status:401});
 const m=await prisma.membership.findFirst({where:{userId:s.user.id}});const user=await prisma.user.findUnique({where:{id:s.user.id},select:{role:true}});if(!m)return NextResponse.json({error:'Workspace required'},{status:403});
 const body=schema.safeParse(await req.json());if(!body.success)return NextResponse.json({error:'Invalid status'},{status:400});
 if(!['AGENT','MANAGER','ADMIN'].includes(user?.role??'USER'))return NextResponse.json({error:'Agent access required'},{status:403});
 if(['APPROVED','REJECTED'].includes(body.data.status)&&!['MANAGER','ADMIN'].includes(user?.role??'USER'))return NextResponse.json({error:'Manager approval is required for this decision'},{status:403});
 const {id}=await params;const old=await prisma.insuranceRequest.findFirst({where:{id,organizationId:m.organizationId}});if(!old)return NextResponse.json({error:'Not found'},{status:404});
 const r=await prisma.insuranceRequest.update({where:{id},data:{status:body.data.status}});await prisma.auditLog.create({data:{userId:s.user.id,organizationId:m.organizationId,action:'REQUEST_STATUS_CHANGED',resource:id,metadata:{from:old.status,to:r.status}}});
 if(r.assignedToId&&r.assignedToId!==s.user.id)await prisma.notification.create({data:{userId:r.assignedToId,type:'STATUS_CHANGED',title:'Request status updated',body:`${r.name}: ${old.status} → ${r.status}`}});
 return NextResponse.json(r);
}

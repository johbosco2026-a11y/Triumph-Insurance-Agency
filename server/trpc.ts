import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function createContext({ headers }: { headers: Headers }) {
  const session = await auth.api.getSession({ headers });
  return { session, prisma };
}
type Context = Awaited<ReturnType<typeof createContext>>;
const t = initTRPC.context<Context>().create({ transformer: superjson });
export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  const user = await prisma.user.findUnique({ where: { id: ctx.session.user.id } });
  if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return next({ ctx: { ...ctx, user } });
});

const roles = ['USER','AGENT','MANAGER','ADMIN'] as const;
type AppRole = typeof roles[number];
const can = (role: string, allowed: AppRole[]) => allowed.includes(role as AppRole);

async function membershipForUser(userId: string) {
  return prisma.membership.findFirst({ where: { userId }, include: { organization: true } });
}
async function requireMembership(userId: string) {
  const membership = await membershipForUser(userId);
  if (!membership) throw new TRPCError({ code: 'FORBIDDEN', message: 'No workspace membership.' });
  return membership;
}
async function audit(userId: string, organizationId: string, action: string, resource?: string, metadata?: unknown) {
  return prisma.auditLog.create({ data: { userId, organizationId, action, resource, metadata: metadata as object | undefined } });
}

const statusSchema = z.enum(['NEW','IN_REVIEW','CONTACTED','PROCESSING','APPROVED','REJECTED','CLOSED']);
const requestInput = z.object({ type: z.string().min(1), name: z.string().min(2), email: z.string().email(), phone: z.string().optional(), message: z.string().min(2) });

export const appRouter = router({
  auth: router({ me: protectedProcedure.query(({ ctx }) => ctx.user) }),
  workspace: router({
    overview: protectedProcedure.query(async ({ ctx }) => {
      const m = await requireMembership(ctx.user.id);
      const where = { organizationId: m.organizationId };
      const [total, fresh, review, contacted, processing, approved, rejected, closed, customers, agents, recent] = await Promise.all([
        prisma.insuranceRequest.count({ where }), prisma.insuranceRequest.count({ where: { ...where, status: 'NEW' } }), prisma.insuranceRequest.count({ where: { ...where, status: 'IN_REVIEW' } }), prisma.insuranceRequest.count({ where: { ...where, status: 'CONTACTED' } }), prisma.insuranceRequest.count({ where: { ...where, status: 'PROCESSING' } }), prisma.insuranceRequest.count({ where: { ...where, status: 'APPROVED' } }), prisma.insuranceRequest.count({ where: { ...where, status: 'REJECTED' } }), prisma.insuranceRequest.count({ where: { ...where, status: 'CLOSED' } }), prisma.customer.count({ where: { organizationId: m.organizationId } }), prisma.membership.count({ where: { organizationId: m.organizationId, role: { in: ['OWNER','ADMIN','MEMBER'] } } }), prisma.insuranceRequest.findMany({ where, orderBy: { createdAt: 'desc' }, take: 8, include: { assignedTo: true } })
      ]);
      return { organization: m.organization, role: m.role, counts: { total, new: fresh, review, contacted, processing, approved, rejected, closed, customers, agents }, recent };
    }),
    notifications: protectedProcedure.query(({ ctx }) => prisma.notification.findMany({ where: { userId: ctx.user.id }, orderBy: { createdAt: 'desc' }, take: 30 })),
    markNotificationRead: protectedProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => prisma.notification.updateMany({ where: { id: input.id, userId: ctx.user.id }, data: { readAt: new Date() } }))
  }),
  requests: router({
    create: protectedProcedure.input(requestInput).mutation(async ({ ctx, input }) => {
      const m = await requireMembership(ctx.user.id);
      const customer = await prisma.customer.upsert({ where: { organizationId_email: { organizationId: m.organizationId, email: input.email } }, update: { name: input.name, phone: input.phone }, create: { organizationId: m.organizationId, name: input.name, email: input.email, phone: input.phone } });
      const request = await prisma.insuranceRequest.create({ data: { ...input, userId: ctx.user.id, organizationId: m.organizationId, customerId: customer.id } });
      await audit(ctx.user.id, m.organizationId, 'REQUEST_CREATED', request.id);
      return request;
    }),
    list: protectedProcedure.input(z.object({ status: statusSchema.optional(), assignedToId: z.string().optional(), search: z.string().optional() }).optional()).query(async ({ ctx, input }) => {
      const m = await requireMembership(ctx.user.id); const search = input?.search?.trim();
      return prisma.insuranceRequest.findMany({ where: { organizationId: m.organizationId, ...(input?.status ? { status: input.status } : {}), ...(input?.assignedToId ? { assignedToId: input.assignedToId } : {}), ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }, { type: { contains: search, mode: 'insensitive' } }] } : {}) }, orderBy: { createdAt: 'desc' }, take: 100, include: { assignedTo: true, customer: true } });
    }),
    get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
      const m = await requireMembership(ctx.user.id); const r = await prisma.insuranceRequest.findFirst({ where: { id: input.id, organizationId: m.organizationId }, include: { assignedTo: true, customer: true, notes: { include: { author: true }, orderBy: { createdAt: 'desc' } } } });
      if (!r) throw new TRPCError({ code: 'NOT_FOUND' }); return r;
    }),
    updateStatus: protectedProcedure.input(z.object({ id: z.string(), status: statusSchema })).mutation(async ({ ctx, input }) => {
      const m = await requireMembership(ctx.user.id); if (!can(ctx.user.role ?? 'USER', ['AGENT','MANAGER','ADMIN'])) throw new TRPCError({ code: 'FORBIDDEN' });
      const old = await prisma.insuranceRequest.findFirst({ where: { id: input.id, organizationId: m.organizationId } }); if (!old) throw new TRPCError({ code: 'NOT_FOUND' });
      const updated = await prisma.insuranceRequest.update({ where: { id: old.id }, data: { status: input.status } });
      await audit(ctx.user.id, m.organizationId, 'REQUEST_STATUS_CHANGED', old.id, { from: old.status, to: updated.status });
      if (old.assignedToId) await prisma.notification.create({ data: { userId: old.assignedToId, type: 'STATUS_CHANGED', title: 'Request status updated', body: `${old.name}: ${old.status} → ${updated.status}` } });
      return updated;
    }),
    assign: protectedProcedure.input(z.object({ id: z.string(), assigneeId: z.string().nullable() })).mutation(async ({ ctx, input }) => {
      const m = await requireMembership(ctx.user.id); if (!can(ctx.user.role ?? 'USER', ['MANAGER','ADMIN'])) throw new TRPCError({ code: 'FORBIDDEN' });
      const r = await prisma.insuranceRequest.findFirst({ where: { id: input.id, organizationId: m.organizationId } }); if (!r) throw new TRPCError({ code: 'NOT_FOUND' });
      if (input.assigneeId) { const target = await prisma.membership.findFirst({ where: { userId: input.assigneeId, organizationId: m.organizationId } }); if (!target) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Assignee is not a workspace member.' }); }
      const updated = await prisma.insuranceRequest.update({ where: { id: r.id }, data: { assignedToId: input.assigneeId } });
      await audit(ctx.user.id, m.organizationId, 'REQUEST_ASSIGNED', r.id, { assigneeId: input.assigneeId });
      if (input.assigneeId) await prisma.notification.create({ data: { userId: input.assigneeId, type: 'REQUEST_ASSIGNED', title: 'New request assigned', body: `${r.name} · ${r.type}` } });
      return updated;
    }),
    addNote: protectedProcedure.input(z.object({ id: z.string(), body: z.string().min(2).max(4000) })).mutation(async ({ ctx, input }) => {
      const m = await requireMembership(ctx.user.id); const r = await prisma.insuranceRequest.findFirst({ where: { id: input.id, organizationId: m.organizationId } }); if (!r) throw new TRPCError({ code: 'NOT_FOUND' });
      const note = await prisma.requestNote.create({ data: { requestId: r.id, authorId: ctx.user.id, body: input.body }, include: { author: true } }); await audit(ctx.user.id, m.organizationId, 'REQUEST_NOTE_ADDED', r.id); return note;
    })
  }),
  customers: router({
    list: protectedProcedure.input(z.object({ search: z.string().optional() }).optional()).query(async ({ ctx, input }) => { const m = await requireMembership(ctx.user.id); const q=input?.search?.trim(); return prisma.customer.findMany({ where:{organizationId:m.organizationId,...(q?{OR:[{name:{contains:q,mode:'insensitive'}},{email:{contains:q,mode:'insensitive'}},{phone:{contains:q,mode:'insensitive'}}]}:{})}, orderBy:{updatedAt:'desc'}, take:100, include:{requests:{orderBy:{createdAt:'desc'},take:3}} }); }),
    create: protectedProcedure.input(z.object({ name:z.string().min(2), email:z.string().email(), phone:z.string().optional() })).mutation(async ({ctx,input})=>{const m=await requireMembership(ctx.user.id); const c=await prisma.customer.create({data:{...input,organizationId:m.organizationId}}); await audit(ctx.user.id,m.organizationId,'CUSTOMER_CREATED',c.id); return c;})
  }),
  team: router({
    list: protectedProcedure.query(async ({ctx})=>{const m=await requireMembership(ctx.user.id); if(!can(ctx.user.role??'USER',['MANAGER','ADMIN']))throw new TRPCError({code:'FORBIDDEN'}); return prisma.membership.findMany({where:{organizationId:m.organizationId},include:{user:true},orderBy:{createdAt:'asc'}})}),
    invite: protectedProcedure.input(z.object({email:z.string().email(),role:z.enum(['MEMBER','VIEWER'])})).mutation(async({ctx,input})=>{const m=await requireMembership(ctx.user.id); if(!can(ctx.user.role??'USER',['MANAGER','ADMIN']))throw new TRPCError({code:'FORBIDDEN'}); const token=crypto.randomUUID(); const invitation=await prisma.invitation.create({data:{organizationId:m.organizationId,email:input.email.toLowerCase(),role:input.role,token,invitedById:ctx.user.id,expiresAt:new Date(Date.now()+1000*60*60*48)}}); await audit(ctx.user.id,m.organizationId,'MEMBER_INVITED',invitation.id,{email:input.email,role:input.role}); return invitation;}),
    changeRole: protectedProcedure.input(z.object({userId:z.string(),role:z.enum(['MEMBER','VIEWER','ADMIN'])})).mutation(async({ctx,input})=>{const m=await requireMembership(ctx.user.id); if(!can(ctx.user.role??'USER',['ADMIN']))throw new TRPCError({code:'FORBIDDEN'}); if(input.userId===ctx.user.id && input.role!=='ADMIN')throw new TRPCError({code:'BAD_REQUEST',message:'You cannot remove your own admin access.'}); const target=await prisma.membership.findFirst({where:{userId:input.userId,organizationId:m.organizationId}}); if(!target)throw new TRPCError({code:'NOT_FOUND'}); const updated=await prisma.membership.update({where:{id:target.id},data:{role:input.role}}); await audit(ctx.user.id,m.organizationId,'ROLE_CHANGED',input.userId,{role:input.role}); return updated;})
  }),
  reports: router({
    overview: protectedProcedure.query(async({ctx})=>{const m=await requireMembership(ctx.user.id); if(!can(ctx.user.role??'USER',['MANAGER','ADMIN']))throw new TRPCError({code:'FORBIDDEN'}); const [byStatus,byType,byAgent]=await Promise.all([prisma.insuranceRequest.groupBy({by:['status'],where:{organizationId:m.organizationId},_count:{_all:true}}),prisma.insuranceRequest.groupBy({by:['type'],where:{organizationId:m.organizationId},_count:{_all:true}}),prisma.insuranceRequest.groupBy({by:['assignedToId'],where:{organizationId:m.organizationId,assignedToId:{not:null}},_count:{_all:true}})]); const ids=byAgent.map(x=>x.assignedToId!).filter(Boolean); const users=await prisma.user.findMany({where:{id:{in:ids}},select:{id:true,name:true,email:true}}); return {byStatus,byType,byAgent:byAgent.map(x=>({...x,agent:users.find(u=>u.id===x.assignedToId)}))};})
  }),
  admin: router({ audit: protectedProcedure.query(async({ctx})=>{const m=await requireMembership(ctx.user.id);if(!can(ctx.user.role??'USER',['MANAGER','ADMIN']))throw new TRPCError({code:'FORBIDDEN'});return prisma.auditLog.findMany({where:{organizationId:m.organizationId},orderBy:{createdAt:'desc'},take:200,include:{user:true}})}) })
});
export type AppRouter = typeof appRouter;

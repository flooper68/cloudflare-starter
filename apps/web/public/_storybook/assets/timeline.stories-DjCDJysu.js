import{a6 as u,ca as s,j as e,h as r,cb as m,B as x,I as p,cc as h,x as l,cd as o,ce as j}from"./iframe-BjN4PNZi.js";import{U as v}from"./user-plus-DQ5D-oOB.js";import{T}from"./tag-D81nTkkR.js";import"./preload-helper-PPVm8Dsz.js";const g={name:"git-pull-request",size:24,node:[["circle",{cx:"18",cy:"18",r:"3",key:"1xkwt0"}],["circle",{cx:"6",cy:"6",r:"3",key:"1lh9wr"}],["path",{d:"M13 6h3a2 2 0 0 1 2 2v7",key:"1yeb86"}],["line",{x1:"6",x2:"6",y1:"9",y2:"21",key:"rroup"}]]};g.node;const A=u(g),n=t=>new Date(Date.now()-t*6e4),L={title:"Data display/Timeline",component:s,tags:["autodocs"],args:{icon:e.jsx(r,{name:"Ada Lovelace",size:"xs"}),children:e.jsxs(e.Fragment,{children:[e.jsx("strong",{children:"Ada Lovelace"})," changed status from ",e.jsx("strong",{children:"Todo"})," ","to ",e.jsx("strong",{children:"In Progress"})]}),time:n(42),last:!0},decorators:[t=>e.jsx(j,{className:"w-[520px]",children:e.jsx(t,{})})],parameters:{docs:{description:{component:`The activity feed of an issue: one-line events (with the actor in bold and a relative
time) and comments in bubbles, joined by a thin line.`}}}},i={},a={render:()=>e.jsxs(e.Fragment,{children:[e.jsxs(s,{icon:e.jsx(r,{name:"Grace Hopper",size:"xs"}),time:n(1560),children:[e.jsx("strong",{children:"Grace Hopper"})," created the issue"]}),e.jsxs(s,{icon:e.jsx(v,{}),time:n(1500),children:[e.jsx("strong",{children:"Grace Hopper"})," assigned to ",e.jsx("strong",{children:"Ada Lovelace"})]}),e.jsxs(s,{icon:e.jsx(T,{}),time:n(1500),children:[e.jsx("strong",{children:"Linear"})," added label ",e.jsx("strong",{children:"Bug"})]}),e.jsxs(s,{icon:e.jsx(l,{status:"in_progress",label:""}),time:n(180),children:[e.jsx("strong",{children:"Ada Lovelace"})," moved from ",e.jsx("strong",{children:"Todo"})," to"," ",e.jsx("strong",{children:"In Progress"})]}),e.jsxs(s,{icon:e.jsx(A,{}),time:n(12),last:!0,children:[e.jsx("strong",{children:"Ada Lovelace"})," linked"," ",e.jsx("strong",{children:"#2381 Retry uploads after reconnect"})]})]})},c={render:()=>e.jsxs(e.Fragment,{children:[e.jsxs(s,{icon:e.jsx(r,{name:"Grace Hopper",size:"xs"}),time:n(3e3),children:[e.jsx("strong",{children:"Grace Hopper"})," created the issue"]}),e.jsxs(m,{avatar:e.jsx(r,{name:"Alan Turing",size:"sm"}),author:"Alan Turing",time:n(1800),footer:e.jsxs(e.Fragment,{children:[e.jsx(x,{size:"xs",variant:"secondary",children:"👀 2"}),e.jsx(p,{label:"Add reaction",size:"xs",children:e.jsx(h,{})})]}),children:[e.jsx("p",{children:"Reproduced on iOS 18 with airplane mode toggled during a 40 MB upload. The queue never resumes because the retry timer is cleared on background."}),e.jsx("p",{children:"I think we need to persist the queue and resume on reconnect."})]}),e.jsxs(s,{icon:e.jsx(l,{status:"in_progress",label:""}),time:n(240),children:[e.jsx("strong",{children:"Ada Lovelace"})," moved from ",e.jsx("strong",{children:"Todo"})," to"," ",e.jsx("strong",{children:"In Progress"})]}),e.jsx(m,{avatar:e.jsx(r,{name:"Ada Lovelace",size:"sm"}),author:"Ada Lovelace",time:n(25),last:!0,children:"PR is up, persisting the queue in IndexedDB. Testing on Android next."})]})},d={decorators:[t=>e.jsx(t,{})],render:()=>e.jsxs("div",{className:"flex flex-col gap-1 text-sm",children:[e.jsx(o,{date:n(1)}),e.jsx(o,{date:n(90)}),e.jsx(o,{date:n(1440*3)}),e.jsx(o,{date:n(1440*60)})]})},R=["Playground","EventKinds","ActivityFeed","RelativeTimes"];i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:"{}",...i.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  render: () => <>
      <TimelineItem icon={<Avatar name="Grace Hopper" size="xs" />} time={minutesAgo(60 * 26)}>
        <strong>Grace Hopper</strong> created the issue
      </TimelineItem>
      <TimelineItem icon={<UserPlus />} time={minutesAgo(60 * 25)}>
        <strong>Grace Hopper</strong> assigned to <strong>Ada Lovelace</strong>
      </TimelineItem>
      <TimelineItem icon={<TagIcon />} time={minutesAgo(60 * 25)}>
        <strong>Linear</strong> added label <strong>Bug</strong>
      </TimelineItem>
      <TimelineItem icon={<StatusIcon status="in_progress" label="" />} time={minutesAgo(180)}>
        <strong>Ada Lovelace</strong> moved from <strong>Todo</strong> to{" "}
        <strong>In Progress</strong>
      </TimelineItem>
      <TimelineItem icon={<GitPullRequest />} time={minutesAgo(12)} last>
        <strong>Ada Lovelace</strong> linked{" "}
        <strong>#2381 Retry uploads after reconnect</strong>
      </TimelineItem>
    </>
}`,...a.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  render: () => <>
      <TimelineItem icon={<Avatar name="Grace Hopper" size="xs" />} time={minutesAgo(60 * 50)}>
        <strong>Grace Hopper</strong> created the issue
      </TimelineItem>
      <TimelineComment avatar={<Avatar name="Alan Turing" size="sm" />} author="Alan Turing" time={minutesAgo(60 * 30)} footer={<>
            <Button size="xs" variant="secondary">
              👀 2
            </Button>
            <IconButton label="Add reaction" size="xs">
              <SmilePlus />
            </IconButton>
          </>}>
        <p>
          Reproduced on iOS 18 with airplane mode toggled during a 40 MB upload.
          The queue never resumes because the retry timer is cleared on
          background.
        </p>
        <p>I think we need to persist the queue and resume on reconnect.</p>
      </TimelineComment>
      <TimelineItem icon={<StatusIcon status="in_progress" label="" />} time={minutesAgo(60 * 4)}>
        <strong>Ada Lovelace</strong> moved from <strong>Todo</strong> to{" "}
        <strong>In Progress</strong>
      </TimelineItem>
      <TimelineComment avatar={<Avatar name="Ada Lovelace" size="sm" />} author="Ada Lovelace" time={minutesAgo(25)} last>
        PR is up, persisting the queue in IndexedDB. Testing on Android next.
      </TimelineComment>
    </>
}`,...c.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  decorators: [Story => <Story />],
  render: () => <div className="flex flex-col gap-1 text-sm">
      <RelativeTime date={minutesAgo(1)} />
      <RelativeTime date={minutesAgo(90)} />
      <RelativeTime date={minutesAgo(60 * 24 * 3)} />
      <RelativeTime date={minutesAgo(60 * 24 * 60)} />
    </div>
}`,...d.parameters?.docs?.source}}};export{c as ActivityFeed,a as EventKinds,i as Playground,d as RelativeTimes,R as __namedExportsOrder,L as default};

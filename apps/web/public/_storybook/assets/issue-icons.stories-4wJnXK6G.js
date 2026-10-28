import{u as c,x as t,j as e,E as r,y as d,z as m,w as p}from"./iframe-BjN4PNZi.js";import"./preload-helper-PPVm8Dsz.js";const g={title:"Data display/Issue icons",component:t,tags:["autodocs"],args:{status:"in_progress"},argTypes:{status:{control:"select",options:c}},parameters:{docs:{description:{component:'Linear-style issue glyphs. `StatusIcon` draws the workflow state (backlog, todo, in\nprogress, in review, done, canceled); `PriorityIcon` the priority bars. Both are plain\nSVG coloured from tokens, with an accessible name (pass `label=""` when the text next\nto them already says it). The state and priority lists and labels are exported too.'}}}},a={},i={render:()=>e.jsx("div",{className:"flex flex-col gap-2",children:c.map(s=>e.jsxs("div",{className:"flex items-center gap-2 text-sm text-fg",children:[e.jsx(t,{status:s,label:""}),p[s]]},s))})},o={render:()=>e.jsx("div",{className:"flex flex-col gap-2",children:d.map(s=>e.jsxs("div",{className:"flex items-center gap-2 text-sm text-fg",children:[e.jsx(r,{priority:s,label:""}),m[s]]},s))})},n={render:()=>e.jsxs("div",{className:"flex items-center gap-4",children:[e.jsx(t,{status:"in_review",className:"size-3"}),e.jsx(t,{status:"in_review"}),e.jsx(t,{status:"in_review",className:"size-5"}),e.jsx(r,{priority:"high",className:"size-3.5"}),e.jsx(r,{priority:"high"}),e.jsx(r,{priority:"high",className:"size-5"})]})},l={render:()=>e.jsx("div",{className:"flex w-[480px] flex-col rounded-lg border border-line",children:[{id:"ENG-412",title:"Sync stalls when the device goes offline mid-upload",status:"in_progress",priority:"urgent"},{id:"ENG-398",title:"Keyboard shortcut for moving issues between cycles",status:"in_review",priority:"medium"},{id:"ENG-377",title:"Remove legacy webhooks v1 endpoints",status:"backlog",priority:"low"},{id:"ENG-350",title:"Dark mode contrast on the roadmap timeline",status:"done",priority:"high"}].map(s=>e.jsxs("div",{className:"flex h-10 items-center gap-3 border-b border-line px-3 text-sm last:border-b-0",children:[e.jsx(r,{priority:s.priority}),e.jsx("span",{className:"w-16 text-fg-muted tabular-nums",children:s.id}),e.jsx(t,{status:s.status}),e.jsx("span",{className:"truncate text-fg",children:s.title})]},s.id))})},y=["Playground","Statuses","Priorities","Sizes","InContext"];a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:"{}",...a.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-col gap-2">
      {issueStatuses.map(status => <div key={status} className="flex items-center gap-2 text-sm text-fg">
          <StatusIcon status={status} label="" />
          {issueStatusLabel[status]}
        </div>)}
    </div>
}`,...i.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-col gap-2">
      {issuePriorities.map(priority => <div key={priority} className="flex items-center gap-2 text-sm text-fg">
          <PriorityIcon priority={priority} label="" />
          {issuePriorityLabel[priority]}
        </div>)}
    </div>
}`,...o.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex items-center gap-4">
      <StatusIcon status="in_review" className="size-3" />
      <StatusIcon status="in_review" />
      <StatusIcon status="in_review" className="size-5" />
      <PriorityIcon priority="high" className="size-3.5" />
      <PriorityIcon priority="high" />
      <PriorityIcon priority="high" className="size-5" />
    </div>
}`,...n.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex w-[480px] flex-col rounded-lg border border-line">
      {([{
      id: "ENG-412",
      title: "Sync stalls when the device goes offline mid-upload",
      status: "in_progress",
      priority: "urgent"
    }, {
      id: "ENG-398",
      title: "Keyboard shortcut for moving issues between cycles",
      status: "in_review",
      priority: "medium"
    }, {
      id: "ENG-377",
      title: "Remove legacy webhooks v1 endpoints",
      status: "backlog",
      priority: "low"
    }, {
      id: "ENG-350",
      title: "Dark mode contrast on the roadmap timeline",
      status: "done",
      priority: "high"
    }] as const).map(issue => <div key={issue.id} className="flex h-10 items-center gap-3 border-b border-line px-3 text-sm last:border-b-0">
          <PriorityIcon priority={issue.priority} />
          <span className="w-16 text-fg-muted tabular-nums">{issue.id}</span>
          <StatusIcon status={issue.status} />
          <span className="truncate text-fg">{issue.title}</span>
        </div>)}
    </div>
}`,...l.parameters?.docs?.source}}};export{l as InContext,a as Playground,o as Priorities,n as Sizes,i as Statuses,y as __namedExportsOrder,g as default};

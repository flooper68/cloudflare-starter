import{j as s,C as d,aT as l,aU as p,B as x,P as y,aV as c}from"./iframe-BjN4PNZi.js";import{I as g}from"./inbox-CXA9en-m.js";import"./preload-helper-PPVm8Dsz.js";const j={title:"Feedback/DataState",parameters:{layout:"centered"},argTypes:{status:{control:"inline-radio",options:["pending","error","success-empty","success"]}},args:{status:"success"}},S=[{id:"ENG-142",title:"Sign-in link expires before the email arrives"},{id:"ENG-155",title:"Filter issues by assignee and label"},{id:"ENG-160",title:"Rate-limit the MCP token endpoint"}],e={render:({status:n})=>{const u=n==="success-empty"?"success":n,m=n==="success-empty"?[]:S;return s.jsxs(d,{className:"w-[420px] p-0",children:[s.jsx("div",{className:"border-b border-line px-4 py-3 text-sm font-medium",children:"My issues"}),s.jsx(l,{status:u,data:u==="success"?m:void 0,error:new Error("The server didn't answer."),onRetry:()=>new Promise(o=>setTimeout(o,800)),loading:s.jsxs("div",{className:"py-1",children:[s.jsx(c,{}),s.jsx(c,{}),s.jsx(c,{})]}),empty:s.jsx(p,{variant:"compact",icon:s.jsx(g,{}),title:"No issues assigned to you",description:"Issues you're assigned show up here.",primaryAction:s.jsx(x,{size:"sm",variant:"primary",icon:s.jsx(y,{}),children:"New issue"})}),children:o=>s.jsx("ul",{className:"py-1",children:o.map(i=>s.jsxs("li",{className:"flex h-9 items-center gap-3 px-4 text-sm hover:bg-hover",children:[s.jsx("span",{className:"font-mono text-xs text-fg-subtle",children:i.id}),s.jsx("span",{className:"truncate",children:i.title})]},i.id))})})]})}},t={...e,args:{status:"pending"}},a={...e,args:{status:"error"}},r={...e,args:{status:"success-empty"}},b=["AllStates","Loading","Failed","Empty"];e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  render: ({
    status
  }) => {
    const queryStatus: DataStatus = status === "success-empty" ? "success" : status as DataStatus;
    const data = status === "success-empty" ? [] : issues;
    return <Card className="w-[420px] p-0">
        <div className="border-b border-line px-4 py-3 text-sm font-medium">
          My issues
        </div>
        <DataState status={queryStatus} data={queryStatus === "success" ? data : undefined} error={new Error("The server didn't answer.")} onRetry={() => new Promise(resolve => setTimeout(resolve, 800))} loading={<div className="py-1">
              <SkeletonListRow />
              <SkeletonListRow />
              <SkeletonListRow />
            </div>} empty={<EmptyState variant="compact" icon={<Inbox />} title="No issues assigned to you" description="Issues you're assigned show up here." primaryAction={<Button size="sm" variant="primary" icon={<Plus />}>
                  New issue
                </Button>} />}>
          {items => <ul className="py-1">
              {items.map(issue => <li key={issue.id} className="flex h-9 items-center gap-3 px-4 text-sm hover:bg-hover">
                  <span className="font-mono text-xs text-fg-subtle">
                    {issue.id}
                  </span>
                  <span className="truncate">{issue.title}</span>
                </li>)}
            </ul>}
        </DataState>
      </Card>;
  }
}`,...e.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  ...AllStates,
  args: {
    status: "pending"
  }
}`,...t.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  ...AllStates,
  args: {
    status: "error"
  }
}`,...a.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  ...AllStates,
  args: {
    status: "success-empty"
  }
}`,...r.parameters?.docs?.source}}};export{e as AllStates,r as Empty,a as Failed,t as Loading,b as __namedExportsOrder,j as default};

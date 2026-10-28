import{bd as r,j as e,r as g,be as p,bf as x,w as h,I as b,P as w,x as m,b6 as j,h as f,E as y}from"./iframe-BjN4PNZi.js";import"./preload-helper-PPVm8Dsz.js";const S=[{id:"ENG-412",title:"Sync stalls when the device goes offline mid-upload",status:"in_progress",priority:"urgent",assignee:"Ada Lovelace",label:{name:"Bug",color:"danger"},date:"Oct 24"},{id:"ENG-405",title:"Keyboard shortcut for moving issues between cycles",status:"in_progress",priority:"medium",assignee:"Grace Hopper",label:{name:"Feature",color:"accent"},date:"Oct 22"},{id:"ENG-398",title:"Paginate the audit log API",status:"in_review",priority:"high",assignee:"Alan Turing",label:{name:"Improvement",color:"info"},date:"Oct 21"},{id:"ENG-391",title:"Remove legacy webhooks v1 endpoints",status:"todo",priority:"low",assignee:"Barbara Liskov",date:"Oct 19"},{id:"ENG-384",title:"Slack notification shows raw markdown",status:"todo",priority:"none",assignee:"Katherine Johnson",label:{name:"Bug",color:"danger"},date:"Oct 18"}];function v({row:t,selected:c,onSelect:d}){return e.jsx(r,{selected:c,onSelect:d,leading:e.jsxs(e.Fragment,{children:[e.jsx(y,{priority:t.priority}),e.jsx("span",{className:"w-14 whitespace-nowrap text-xs tabular-nums",children:t.id}),e.jsx(m,{status:t.status})]}),title:t.title,trailing:e.jsxs(e.Fragment,{children:[t.label?e.jsx(j,{size:"sm",color:t.label.color,children:t.label.name}):null,e.jsx("span",{className:"w-12 text-right",children:t.date}),e.jsx(f,{name:t.assignee,size:"sm"})]})})}const N={title:"Data display/List",component:r,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"Linear-style rows for issue lists, inbox and search results. Focus a row and use\n↑/↓ (or j/k), Home/End; Enter or Space activates it. Group rows with `ListHeader`."}}},args:{title:"Sync stalls when the device goes offline mid-upload",description:"ENG-412",selected:!1,disabled:!1},decorators:[t=>e.jsx(p,{label:"Issues",className:"rounded-lg border border-line",children:e.jsx(t,{})})]},i={},n={render:()=>e.jsxs(e.Fragment,{children:[e.jsx(r,{title:"Default row",trailing:"Oct 24"}),e.jsx(r,{title:"Selected row",selected:!0,trailing:"Oct 22"}),e.jsx(r,{title:"Disabled row",disabled:!0,trailing:"Oct 21"}),e.jsx(r,{title:"With a description",description:"Opened by Grace Hopper",trailing:"Oct 19"})]})},o={decorators:[t=>e.jsx(t,{})],render:()=>{const[t,c]=g.useState("ENG-405"),d=["in_progress","in_review","todo"];return e.jsx(p,{label:"Active issues",className:"w-[720px] overflow-hidden rounded-lg border border-line",children:d.map(a=>{const u=S.filter(s=>s.status===a);return e.jsxs("div",{children:[e.jsx(x,{icon:e.jsx(m,{status:a,label:""}),count:u.length,actions:e.jsx(b,{label:"Add issue",size:"xs",children:e.jsx(w,{})}),children:h[a]}),u.map(s=>e.jsx(v,{row:s,selected:s.id===t,onSelect:()=>c(s.id)},s.id))]},a)})})}},l={render:()=>e.jsx("div",{className:"flex h-24 w-[480px] items-center justify-center text-sm text-fg-muted",children:"No issues match the current filters."})},E=["Playground","States","IssueList","Empty"];i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:"{}",...i.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  render: () => <>
      <ListItem title="Default row" trailing="Oct 24" />
      <ListItem title="Selected row" selected trailing="Oct 22" />
      <ListItem title="Disabled row" disabled trailing="Oct 21" />
      <ListItem title="With a description" description="Opened by Grace Hopper" trailing="Oct 19" />
    </>
}`,...n.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  decorators: [Story => <Story />],
  render: () => {
    const [selected, setSelected] = useState("ENG-405");
    const groups: IssueStatus[] = ["in_progress", "in_review", "todo"];
    return <List label="Active issues" className="w-[720px] overflow-hidden rounded-lg border border-line">
        {groups.map(status => {
        const inGroup = rows.filter(row => row.status === status);
        return <div key={status}>
              <ListHeader icon={<StatusIcon status={status} label="" />} count={inGroup.length} actions={<IconButton label="Add issue" size="xs">
                    <Plus />
                  </IconButton>}>
                {issueStatusLabel[status]}
              </ListHeader>
              {inGroup.map(row => <IssueRow key={row.id} row={row} selected={row.id === selected} onSelect={() => setSelected(row.id)} />)}
            </div>;
      })}
      </List>;
  }
}`,...o.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex h-24 w-[480px] items-center justify-center text-sm text-fg-muted">
      No issues match the current filters.
    </div>
}`,...l.parameters?.docs?.source}}};export{l as Empty,o as IssueList,i as Playground,n as States,E as __namedExportsOrder,N as default};

import{a6 as I,t as l,j as e,cn as v,co as b,v as t,cp as L,r as j,C as N,e as V,f as z,g as M,F as i,u as x,w as y,x as g,y as m,z as S,E as k}from"./iframe-BjN4PNZi.js";import{C as h}from"./clock-CLisaoUw.js";import"./preload-helper-PPVm8Dsz.js";const C={name:"calendar-range",size:24,node:[["rect",{x:"3",y:"3",width:"18",height:"18",rx:"2",key:"h1oib"}],["path",{d:"M16 2v3",key:"otl347"}],["path",{d:"M3 9h18",key:"1pudct"}],["path",{d:"M8 2v3",key:"1ioesn"}],["path",{d:"M17 13h-6",key:"1qbiup"}],["path",{d:"M13 17H7",key:"1x38vv"}],["path",{d:"M7 13h.01",key:"1vezk1"}],["path",{d:"M17 17h.01",key:"1sd3ek"}]]};C.node;const _=I(C);const f={name:"calendar",size:24,node:[["path",{d:"M8 2v3",key:"1ioesn"}],["path",{d:"M16 2v3",key:"otl347"}],["rect",{x:"3",y:"3",width:"18",height:"18",rx:"2",key:"h1oib"}],["path",{d:"M3 9h18",key:"1pudct"}]]};f.node;const G=I(f),H={title:"Forms/Select",component:l,tags:["autodocs"],args:{placeholder:"Set status",size:"md",disabled:!1,"aria-label":"Status",children:null},argTypes:{size:{control:"inline-radio",options:["sm","md","lg"]}},decorators:[s=>e.jsx("div",{className:"w-64",children:e.jsx(s,{})})],render:s=>e.jsx(l,{...s,children:x.map(r=>e.jsx(t,{value:r,icon:e.jsx(g,{status:r,label:""}),children:y[r]},r))}),parameters:{docs:{description:{component:"A select for short, fixed lists (status, priority, cycle length). Same heights as Input;\nitems take an `icon` that also shows in the trigger once picked. For long or searchable\nlists use Combobox."}}}},n={},o={args:{defaultOpen:!0,defaultValue:"in_progress"},decorators:[s=>e.jsx("div",{className:"h-80",children:e.jsx(s,{})})]},c={render:()=>e.jsx("div",{className:"flex flex-col gap-3",children:["sm","md","lg"].map(s=>e.jsx(l,{size:s,defaultValue:"todo","aria-label":`Status (${s})`,children:x.map(r=>e.jsx(t,{value:r,icon:e.jsx(g,{status:r,label:""}),children:y[r]},r))},s))})},d={render:()=>e.jsxs(l,{defaultValue:"2w","aria-label":"Cycle length",defaultOpen:!0,children:[e.jsxs(v,{children:[e.jsx(b,{children:"Cycles"}),e.jsx(t,{value:"1w",icon:e.jsx(h,{}),description:"Fast",children:"1 week"}),e.jsx(t,{value:"2w",icon:e.jsx(h,{}),children:"2 weeks"}),e.jsx(t,{value:"3w",icon:e.jsx(h,{}),disabled:!0,children:"3 weeks"})]}),e.jsx(L,{}),e.jsxs(v,{children:[e.jsx(b,{children:"Longer"}),e.jsx(t,{value:"4w",icon:e.jsx(G,{}),children:"4 weeks"}),e.jsx(t,{value:"8w",icon:e.jsx(_,{}),disabled:!0,description:"Business",children:"8 weeks"})]})]}),decorators:[s=>e.jsx("div",{className:"h-80",children:e.jsx(s,{})})]},u={render:()=>e.jsxs("div",{className:"flex flex-col gap-4",children:[e.jsx(i,{label:"Placeholder",children:e.jsx(l,{placeholder:"Set priority",children:m.map(s=>e.jsx(t,{value:s,children:S[s]},s))})}),e.jsx(i,{label:"Disabled",children:e.jsx(l,{disabled:!0,defaultValue:"high",children:e.jsx(t,{value:"high",icon:e.jsx(k,{priority:"high",label:""}),children:"High"})})}),e.jsx(i,{label:"Priority",error:"Choose a priority before moving to In Progress",children:e.jsx(l,{placeholder:"Set priority",children:m.map(s=>e.jsx(t,{value:s,children:S[s]},s))})})]})},p={render:function(){const[r,w]=j.useState("in_review"),[P,F]=j.useState("high");return e.jsxs(N,{className:"w-80",children:[e.jsx(V,{children:e.jsx(z,{children:"ENG-2148 Slow people picker"})}),e.jsxs(M,{className:"flex flex-col gap-3",children:[e.jsx(i,{label:"Status",children:e.jsx(l,{value:r,onValueChange:a=>w(a),children:x.map(a=>e.jsx(t,{value:a,icon:e.jsx(g,{status:a,label:""}),children:y[a]},a))})}),e.jsx(i,{label:"Priority",children:e.jsx(l,{value:P,onValueChange:a=>F(a),children:m.map(a=>e.jsx(t,{value:a,icon:e.jsx(k,{priority:a,label:""}),children:S[a]},a))})})]})]})}},R=["Playground","Open","Sizes","GroupsAndDisabledItems","States","InIssueProperties"];n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:"{}",...n.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    defaultOpen: true,
    defaultValue: "in_progress"
  },
  decorators: [Story => <div className="h-80">
        <Story />
      </div>]
}`,...o.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-col gap-3">
      {(["sm", "md", "lg"] as const).map(size => <Select key={size} size={size} defaultValue="todo" aria-label={\`Status (\${size})\`}>
          {issueStatuses.map(status => <SelectItem key={status} value={status} icon={<StatusIcon status={status} label="" />}>
              {issueStatusLabel[status]}
            </SelectItem>)}
        </Select>)}
    </div>
}`,...c.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  render: () => <Select defaultValue="2w" aria-label="Cycle length" defaultOpen>
      <SelectGroup>
        <SelectLabel>Cycles</SelectLabel>
        <SelectItem value="1w" icon={<Clock />} description="Fast">
          1 week
        </SelectItem>
        <SelectItem value="2w" icon={<Clock />}>
          2 weeks
        </SelectItem>
        <SelectItem value="3w" icon={<Clock />} disabled>
          3 weeks
        </SelectItem>
      </SelectGroup>
      <SelectSeparator />
      <SelectGroup>
        <SelectLabel>Longer</SelectLabel>
        <SelectItem value="4w" icon={<Calendar />}>
          4 weeks
        </SelectItem>
        <SelectItem value="8w" icon={<CalendarRange />} disabled description="Business">
          8 weeks
        </SelectItem>
      </SelectGroup>
    </Select>,
  decorators: [Story => <div className="h-80">
        <Story />
      </div>]
}`,...d.parameters?.docs?.source}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-col gap-4">
      <Field label="Placeholder">
        <Select placeholder="Set priority">
          {issuePriorities.map(priority => <SelectItem key={priority} value={priority}>
              {issuePriorityLabel[priority]}
            </SelectItem>)}
        </Select>
      </Field>
      <Field label="Disabled">
        <Select disabled defaultValue="high">
          <SelectItem value="high" icon={<PriorityIcon priority="high" label="" />}>
            High
          </SelectItem>
        </Select>
      </Field>
      <Field label="Priority" error="Choose a priority before moving to In Progress">
        <Select placeholder="Set priority">
          {issuePriorities.map(priority => <SelectItem key={priority} value={priority}>
              {issuePriorityLabel[priority]}
            </SelectItem>)}
        </Select>
      </Field>
    </div>
}`,...u.parameters?.docs?.source}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  render: function Render() {
    const [status, setStatus] = useState<IssueStatus>("in_review");
    const [priority, setPriority] = useState<IssuePriority>("high");
    return <Card className="w-80">
        <CardHeader>
          <CardTitle>ENG-2148 Slow people picker</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Field label="Status">
            <Select value={status} onValueChange={value => setStatus(value as IssueStatus)}>
              {issueStatuses.map(item => <SelectItem key={item} value={item} icon={<StatusIcon status={item} label="" />}>
                  {issueStatusLabel[item]}
                </SelectItem>)}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={priority} onValueChange={value => setPriority(value as IssuePriority)}>
              {issuePriorities.map(item => <SelectItem key={item} value={item} icon={<PriorityIcon priority={item} label="" />}>
                  {issuePriorityLabel[item]}
                </SelectItem>)}
            </Select>
          </Field>
        </CardContent>
      </Card>;
  }
}`,...p.parameters?.docs?.source}}};export{d as GroupsAndDisabledItems,p as InIssueProperties,o as Open,n as Playground,c as Sizes,u as States,R as __namedExportsOrder,H as default};

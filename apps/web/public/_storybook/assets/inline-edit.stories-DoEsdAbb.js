import{Q as l,r as d,j as e,C as x,x as f}from"./iframe-BjN4PNZi.js";import"./preload-helper-PPVm8Dsz.js";const h={title:"Forms/InlineEdit",component:l,tags:["autodocs"],args:{defaultValue:"Slow people picker in large workspaces",label:"Issue title",variant:"title",required:!0,disabled:!1,placeholder:"Issue title"},argTypes:{variant:{control:"inline-radio",options:["title","body"]}},decorators:[o=>e.jsx("div",{className:"w-[480px]",children:e.jsx(o,{})})],parameters:{docs:{description:{component:"Text that turns into an input on click or Enter. Enter or blur saves, Escape cancels;\n`onValueChange` fires once per saved edit. Like renaming an issue in Linear."}}}},s={},t={args:{variant:"body",defaultValue:"Mobile app v3",label:"Project name"}},r={args:{defaultValue:"",required:!1,variant:"body",label:"Summary",placeholder:"Add a one-line summary…"}},n={args:{disabled:!0}},a={render:function(){const[c,u]=d.useState("Sync conflicts when editing offline"),[i,m]=d.useState(0);return e.jsxs(x,{className:"flex flex-col gap-2",children:[e.jsxs("div",{className:"flex items-center gap-2 text-fg-subtle text-xs",children:[e.jsx(f,{status:"in_progress",label:""}),"ENG-2131"]}),e.jsx(l,{variant:"title",label:"Issue title",required:!0,maxLength:120,value:c,onValueChange:p=>{u(p),m(g=>g+1)}}),e.jsx(l,{label:"Summary",placeholder:"Add a summary…",defaultValue:"Two people editing the same issue offline lose one set of changes."}),e.jsxs("p",{className:"text-fg-subtle text-xs",children:["Saved ",i," ",i===1?"time":"times"]})]})}},y=["Playground","Body","Empty","Disabled","IssueHeader"];s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:"{}",...s.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    variant: "body",
    defaultValue: "Mobile app v3",
    label: "Project name"
  }
}`,...t.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    defaultValue: "",
    required: false,
    variant: "body",
    label: "Summary",
    placeholder: "Add a one-line summary…"
  }
}`,...r.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    disabled: true
  }
}`,...n.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  render: function Render() {
    const [title, setTitle] = useState("Sync conflicts when editing offline");
    const [saves, setSaves] = useState(0);
    return <Card className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-fg-subtle text-xs">
          <StatusIcon status="in_progress" label="" />
          ENG-2131
        </div>
        <InlineEdit variant="title" label="Issue title" required maxLength={120} value={title} onValueChange={next => {
        setTitle(next);
        setSaves(count => count + 1);
      }} />
        <InlineEdit label="Summary" placeholder="Add a summary…" defaultValue="Two people editing the same issue offline lose one set of changes." />
        <p className="text-fg-subtle text-xs">
          Saved {saves} {saves === 1 ? "time" : "times"}
        </p>
      </Card>;
  }
}`,...a.parameters?.docs?.source},description:{story:"An issue header: edit the title, the saved value and an edit count update on save.",...a.parameters?.docs?.description}}};export{t as Body,n as Disabled,r as Empty,a as IssueHeader,s as Playground,y as __namedExportsOrder,h as default};

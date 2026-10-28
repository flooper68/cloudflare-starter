import{W as s,j as e,F as m,r as p,C as f,e as x,f as v,m as b,g as j,G as C,B as y}from"./iframe-BjN4PNZi.js";import"./preload-helper-PPVm8Dsz.js";const F={title:"Forms/TagInput",component:s,tags:["autodocs"],args:{defaultValue:["frontend","q4-launch"],placeholder:"Add a tag…",size:"md",disabled:!1,addOnBlur:!0,"aria-label":"Tags"},argTypes:{size:{control:"inline-radio",options:["sm","md","lg"]},maxTags:{control:"number"}},decorators:[a=>e.jsx("div",{className:"w-96",children:e.jsx(a,{})})],parameters:{docs:{description:{component:"Free-text tags. Enter or comma adds, Backspace in the empty field removes the last tag,\npasting a comma-separated list adds them all. Duplicates are rejected; `validate` adds\nyour own rules and `onValidationError` reports the message for `<Field error>`."}}}},n={},i={args:{defaultValue:[]}},d={args:{defaultValue:["design-system","accessibility","performance","onboarding","billing","mobile","api"]}},o={render:a=>e.jsxs("div",{className:"flex flex-col gap-3",children:[e.jsx(s,{...a,size:"sm"}),e.jsx(s,{...a,size:"md"}),e.jsx(s,{...a,size:"lg"})]})},l={render:a=>e.jsxs("div",{className:"flex flex-col gap-4",children:[e.jsx(m,{label:"Disabled",children:e.jsx(s,{...a,disabled:!0})}),e.jsx(m,{label:"Limit of 3",description:"Stops accepting tags at three.",children:e.jsx(s,{...a,maxTags:3,defaultValue:["ios","android","web"]})})]})},S=/^[^\s@]+@[^\s@]+\.[^\s@]+$/,r={render:function(){const[t,u]=p.useState(["grace@acme.dev"]),[g,h]=p.useState(null);return e.jsxs(f,{children:[e.jsxs(x,{children:[e.jsx(v,{children:"Invite to Acme"}),e.jsx(b,{children:"Paste a list or press Enter after each address."})]}),e.jsx(j,{children:e.jsx(m,{label:"Email addresses",error:g,description:"Only acme.dev addresses.",children:e.jsx(s,{value:t,onValueChange:u,placeholder:"name@acme.dev",validate:c=>S.test(c)?c.endsWith("@acme.dev")?null:"Invite outside guests from Settings":`"${c}" is not an email address`,onValidationError:h})})}),e.jsx(C,{className:"justify-end",children:e.jsxs(y,{variant:"primary",size:"sm",disabled:t.length===0,children:["Send ",t.length," ",t.length===1?"invite":"invites"]})})]})}},V=["Playground","Empty","Wrapping","Sizes","States","WithValidation"];n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:"{}",...n.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    defaultValue: []
  }
}`,...i.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    defaultValue: ["design-system", "accessibility", "performance", "onboarding", "billing", "mobile", "api"]
  }
}`,...d.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  render: args => <div className="flex flex-col gap-3">
      <TagInput {...args} size="sm" />
      <TagInput {...args} size="md" />
      <TagInput {...args} size="lg" />
    </div>
}`,...o.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: args => <div className="flex flex-col gap-4">
      <Field label="Disabled">
        <TagInput {...args} disabled />
      </Field>
      <Field label="Limit of 3" description="Stops accepting tags at three.">
        <TagInput {...args} maxTags={3} defaultValue={["ios", "android", "web"]} />
      </Field>
    </div>
}`,...l.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  render: function Render() {
    const [emails, setEmails] = useState<readonly string[]>(["grace@acme.dev"]);
    const [error, setError] = useState<string | null>(null);
    return <Card>
        <CardHeader>
          <CardTitle>Invite to Acme</CardTitle>
          <CardDescription>
            Paste a list or press Enter after each address.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Field label="Email addresses" error={error} description="Only acme.dev addresses.">
            <TagInput value={emails} onValueChange={setEmails} placeholder="name@acme.dev" validate={tag => {
            if (!emailPattern.test(tag)) return \`"\${tag}" is not an email address\`;
            if (!tag.endsWith("@acme.dev")) return "Invite outside guests from Settings";
            return null;
          }} onValidationError={setError} />
          </Field>
        </CardContent>
        <CardFooter className="justify-end">
          <Button variant="primary" size="sm" disabled={emails.length === 0}>
            Send {emails.length} {emails.length === 1 ? "invite" : "invites"}
          </Button>
        </CardFooter>
      </Card>;
  }
}`,...r.parameters?.docs?.source},description:{story:"Validation hook: only emails at acme.dev, with the message shown by Field.",...r.parameters?.docs?.description}}};export{i as Empty,n as Playground,o as Sizes,l as States,r as WithValidation,d as Wrapping,V as __namedExportsOrder,F as default};
